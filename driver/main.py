from oauth2client.service_account import ServiceAccountCredentials
from googleapiclient.discovery import build
import gspread
from datetime import datetime, timedelta
import os
from dotenv import load_dotenv
import boto3
import json
from logging import warn
import pytz
load_dotenv()


class Course:
    def __init__(self, row):
        self.is_on = False
        self.name = row[0]
        self.link = row[2]
        self.course_type = row[3]
        self.course_id = row[4] if len(row[2]) > 0 else None
        self.days_in = int(row[5])
        self.days_out = int(row[6])

    def __repr__(self):
        return self.name

    def in_time_range(self, time):
        now = datetime.now(pytz.timezone('US/Pacific'))
        if now + timedelta(days=self.days_in) < time < now + timedelta(days=self.days_out):
            return True
        return False


    def book(self, sls, date, start, end, players):
        payload = {
            "url": self.link,
            "date": date,
            "start": start,
            "end": end,
            "players": players
        }
        if self.course_id != '0':
            payload['courseId'] = self.course_id
        warn(f'booking tee time for {self.name} for {payload["date"]}, {payload["start"]} - {payload["end"]} for {payload["players"]} players')
        i = sls.invoke(FunctionName=f'TeeTimeNotifier-dev-{self.course_type}', InvocationType='RequestResponse', Payload=json.dumps(payload))
        print(json.loads(i['Payload'].read()))


class Event:
    def __init__(self, data):
        self.courses = []
        self.id = data['id']
        self.date = datetime.strptime(data['start']['dateTime'].split(":00-07:00")[0], '%Y-%m-%dT%H:%M').replace(tzinfo=pytz.timezone('US/Pacific')).strftime("%m/%d/%Y")
        self.raw_start = datetime.strptime(data['start']['dateTime'].split(":00-07:00")[0], '%Y-%m-%dT%H:%M').replace(tzinfo=pytz.timezone('US/Pacific'))
        self.start = self.raw_start.strftime("%H:%M %p")
        self.end = datetime.strptime(data['end']['dateTime'].split(":00-07:00")[0], '%Y-%m-%dT%H:%M').replace(tzinfo=pytz.timezone('US/Pacific')).strftime("%H:%M %p")
        self.players = data['description'].split("PLAYERS:")[1].strip()[0]

    def book_times(self):
        lambda_client = boto3.client('lambda')
        for course in self.courses:
            course.book(lambda_client, self.date, self.start, self.end, self.players)


    def add_course(self, course):
        self.courses.append(course)


def open_sheet(creds):
    gc = gspread.authorize(creds)
    link = os.environ.get('COURSES_DB')
    sh = gc.open_by_url(link).sheet1
    return sh


def open_calendar(creds):
    service = build("calendar", "v3", credentials=creds)
    return service.events()


def is_on(html, name):
    if html.split(name + ":")[1].strip()[0] == "✅":
        return True
    return False


def lambda_handler(event, context):
    scope = ['https://spreadsheets.google.com/feeds', 'https://www.googleapis.com/auth/calendar.events',
             'https://www.googleapis.com/auth/calendar']
    credentials = ServiceAccountCredentials.from_json_keyfile_name('credentials.json', scope)
    sheet = open_sheet(credentials)  # returns object with access to Google Sheet
    courses = []
    for row in range(2, sheet.row_count):
        row_values = sheet.row_values(row)
        if row_values[0] != "end" and row_values[1] == 'TRUE':
            courses.append(Course(row_values))
        else:
            break
    max_days_out = max([course.days_out for course in courses])
    min_days_in = min([course.days_in for course in courses])
    calendar = open_calendar(credentials)
    now = (datetime.now(pytz.timezone('US/Pacific')) + timedelta(days=min_days_in)).isoformat()
    events = calendar.list(calendarId=os.environ.get('CALENDAR_ID'),
                           timeMin=now,
                           maxResults=(max_days_out - min_days_in),
                           singleEvents=True,
                           orderBy='startTime'
                           ).execute().get('items', [])
    for event in events:
        description = event['description']
        if is_on(description, "STATUS"):
            e = Event(event)
            print(e.start)
            for course in courses:
                print(course)
                print(is_on(description, course.name))
                if is_on(description, course.name) and course.in_time_range(e.raw_start):
                    e.add_course(course)
            e.book_times()

lambda_handler(0, 0)
