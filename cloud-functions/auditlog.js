//Aaron F: This page is meant to record waht actions and when they have been taken so that the client has full informattion on what changes have been incurred witth tthe introduction of an audit page in the admin dashboard tthis will make it easier to test the system with tthe testing master plan which I plan to write
// These logs will go to /auditlogs so that it is protected and only admins can read it and nobody can write to it from the browser view itself, its a window to read server information
// and it can be edited or deleted in anyway from the admin dashboard itself.

"use strict"

//Aaron F: Parametize the varribles.

const TEXT_LIMIT = 210; // Aaron F: I set a limit so that injection atttacks have a harder time compromizing tthe system
const CHANGE_LIMIT = 20; // Aaron F this will limit the ammount of fields tthat can appear which shouldnt interfer with current implementation when we view logs as it should be less than 10 but I put 20 so that enttries with alot of fields dont mess up the view
const SIGN_IN_WINDOW_SECONDS = 5 * 60;  // Aaron F: this will record a sign in immediattely after it happens

