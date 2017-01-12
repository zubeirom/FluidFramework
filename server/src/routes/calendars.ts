import * as express from 'express';
import * as request from 'request';
import * as moment from 'moment';
import { ICalendar, ICalendarEvent } from "../calendar/interfaces";
import * as accounts from '../accounts';
import { Promise } from 'es6-promise';
import { IUser } from '../accounts';
import * as nconf from 'nconf';
import { defaultPartials } from './partials';

var google = require('googleapis');
var googleAuth = require('google-auth-library');

var router = express.Router();

function init() {
}

export interface CalendarRouter {
    router: express.Router;
    init: () => void;
}

export var crouter = <CalendarRouter> {
    router: router,
    init: init
}

function makeCalendarEvent(id: string, title: string, start: string, end: string, self: string, location?: string, responseStatus?: string) {
    return <ICalendarEvent>{
        id: id,
        title: title,
        start: moment(start).toISOString(),
        end: moment(end).toISOString(),
        self: self,
        responseStatus: responseStatus ? responseStatus : "unknown",
        location: location,
    }
}

function makeCalendar(sourceName: string, events: ICalendarEvent[], url?: string) {
   return <ICalendar>{
       events: events,
       sourceName: sourceName
   }
}

router.get('/', (req: express.Request, response: express.Response) => {
    let user = <IUser>(<any>req).user;

    if (!user) {
        return response.json([]);
    }

    let now = moment();
    let nextWeek = now.clone().add(7, 'days');

    var resultPromises: Promise<ICalendar>[] = [];
    for (let account of user.accounts) {
        if (account.provider === 'microsoft') {
            var microsoftCalendarP = new Promise<ICalendar>((resolve, reject) => {
                return accounts.getTokens(account).then((tokens) => {
                    let url = `https://graph.microsoft.com/v1.0/me/calendar/calendarView?$top=25&StartDateTime=${now.toISOString()}&endDateTime=${nextWeek.toISOString()}`;
                    request.get(
                        url,
                        { auth: { 'bearer': tokens.access }, json: true }, (error, response, body) => {
                            if (error) {
                                return reject(error);
                            }
                            else {
                                // MSFT strings are in UTC but don't place the UTC marker in the date string - convert to this format to standardize the input
                                // to CalendarEvent
                                var microsoftResults: ICalendarEvent[] = body.value.map((item) => {
                                    let loc = item.location ? item.location.displayName : "";
                                    return makeCalendarEvent(item.id, item.subject, moment.utc(item.start.dateTime).toISOString(),
                                        moment.utc(item.end.dateTime).toISOString(), `/calendars/microsoft/${item.id}`,
                                        loc, item.responseStatus.response);
                                });

                                let calModel = makeCalendar("Microsoft", microsoftResults, '/calendars/microsoft');

                                return resolve(calModel);
                            }
                        });
                })
            })
            resultPromises.push(microsoftCalendarP);
        }
        else if (account.provider === 'google') {
            var googleCalendarP = new Promise<ICalendar>((resolve, reject) => {
                return accounts.getTokens(account).then((tokens) => {
                    let calendar = google.calendar('v3');
                    var OAuth2 = google.auth.OAuth2;
                    var googleConfig = nconf.get("login:google");
                    var oauth2Client = new google.auth.OAuth2(googleConfig.clientId, googleConfig.secret, '/auth/google');;

                    // Retrieve tokens via token exchange explained above or set them:
                    oauth2Client.setCredentials({
                        access_token: tokens.access,
                        refresh_token: tokens.refresh
                    });

                    calendar.events.list({
                        auth: oauth2Client,
                        calendarId: 'primary',
                        timeMin: (new Date()).toISOString(),
                        maxResults: 10,
                        singleEvents: true,
                        orderBy: 'startTime'
                    }, (err, response) => {
                        if (err) {
                            return reject(err);
                        }
                        else {                                                        
                            var googleResults = <ICalendarEvent[]>response.items.map((item) => 
                                    makeCalendarEvent(item.id, item.summary, item.start.dateTime, item.end.dateTime, 
                                    `/calendars/google/${item.id}`,"", item.status));                                
                            let cal = makeCalendar("Google", googleResults, '/calendars/google');

                            return resolve(cal);
                        }
                    });
                });
            });

            resultPromises.push(googleCalendarP);
        }
    }

    Promise.all(resultPromises).then((calendars) => {
        response.json(calendars);
    }, (error) => {
        response.status(400).json(error);
    });
});

router.delete('/:provider/:id', (req: express.Request, response: express.Response) => {
    let provider = req.params['provider'];
    let eventId = req.params['id'];

    let user = <IUser>(<any>req).user;
    let responseP;

    if (provider === 'microsoft') {
        responseP = accounts.getTokensForProvider(user, provider).then((tokens) => {
            let url = `https://graph.microsoft.com/v1.0/me/events/${eventId}`;
            var deleteP = new Promise((resolve, reject) => {
                request.del(
                    url,
                    { auth: { 'bearer': tokens.access }, json: true },
                    (error, response, body) => {
                        if (error) {
                            return reject(error);
                        }
                        else {
                            return resolve();
                        }
                    });
            });

            return deleteP;
        });
    }
    else if (provider === 'google') {
        responseP = accounts.getTokensForProvider(user, provider).then((tokens) => {
            var deleteP = new Promise((resolve, reject) => {
                let calendar = google.calendar('v3');
                var OAuth2 = google.auth.OAuth2;
                var googleConfig = nconf.get("login:google");
                var oauth2Client = new google.auth.OAuth2(googleConfig.clientId, googleConfig.secret, '/auth/google');;

                // Retrieve tokens via token exchange explained above or set them:
                oauth2Client.setCredentials({
                    access_token: tokens.access,
                    refresh_token: tokens.refresh
                });

                calendar.events.delete({
                    auth: oauth2Client,
                    calendarId: 'primary',
                    eventId: eventId
                },
                    (err, response) => {
                        if (err) {
                            return reject(err);
                        }
                        else {
                            return resolve();
                        }
                    });
            });

            return deleteP;
        });
    }
    else {
        responseP = Promise.reject({ message: 'Unknown provider' });
    }

    responseP.then(
        () => response.status(204).end(),
        (error) => response.status(400).json(error));
});

router.get('/views', (req: express.Request, response: express.Response) => {
    response.render(
        'calendar',
        {
            title: 'ProNet',
            user: (<any> req).user,
            partials: defaultPartials
        });
});
