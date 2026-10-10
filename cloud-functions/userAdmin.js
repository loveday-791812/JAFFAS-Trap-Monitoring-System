"use strict";/* Aaron.F: All requests are contucted through firebase through tthe use of the Firebase ID Token it will be stored in the database not 
in the browser the role policys checks if the change is allowed with tthis page will write the roles.*/

const policy = require("./rolePolicy");//Aaron F: .will require rolePolicy

const RECENT_SIGN_IN_SECONDS = 3 * 60; //Aaron F: the tracking so that the account holder needs to have signed in in the past 180 seconds as an added layer of protection againstt unauthoriszed delteion of the account
const UID_PATTERN = /^[A-Za-z0-9_-]{1, 128}$/; // Firebase UID pattern/format validates the value inside the database


/*Aaron F: User admin logic for role changes, approvals and deleting own account*/

