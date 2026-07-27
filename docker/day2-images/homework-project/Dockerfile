# This Dockerfile works. It is also bad in at least eight distinct ways, every
# one of which was covered in Day 2.
#
# Your job: find them, fix them, and MEASURE the difference.
# Do not just rewrite it from memory -- work out what each line costs.

FROM python:latest

RUN apt-get update
RUN apt-get install -y curl vim git build-essential

ENV SECRET_KEY=super-secret-do-not-share
ENV APP_ENV=production

WORKDIR /app

ADD . /app

RUN pip install -r requirements.txt

EXPOSE 5000

CMD gunicorn --bind 0.0.0.0:5000 app:app
