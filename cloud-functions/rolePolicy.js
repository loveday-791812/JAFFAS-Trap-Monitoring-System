"use strict";// Aaron.F: This file defines the roles that can be requested by users in the system. It exports an array of roles that are considered requestable, meaning that users can request these roles to be assigned to them. The roles are defined as strings and can be used throughout the application to manage user permissions and access control.

const PENDING = "pending";// Aaron.F: This constant represents the "pending" status for role requests. When a user requests a role, their request will be marked as "pending" until it is reviewed and approved or denied by an administrator. This status helps track the progress of role requests and ensures that users are aware of the current state of their requests.
const REQUESTABLE_ROLES = ["worker", "manager"] // Aaron.F: Roles that can be requested by users. These roles are considered requestable, meaning that users can submit requests to be assigned these roles. The roles are defined as strings and can be used throughout the application to manage user permissions and access control.
const ASSiGNABLE_ROLES = ["worker", "manager", "admin"] // Aaron.F: Roles that can be assigned by an admin. Admin can assign these roles to users based on their responsibilities and access requirements. This helps maintain a structured role hierarchy and ensures that users have the appropriate permissions for their tasks.


const ALLOW = Object.freeze({ok:true}); //Aaron F: Sets allow and deny logic for role
const deny = (status, reason) => ({ok:false, status, reason}); // Aaron F: sets deny logic for role



//Aaron F: Sign up logic is that the worker and manager can be requested by the user and then approved by the admin. Admin can only be assigned by the admin to a user who has been approved for a role. This ensures that only authorized users can gain access to sensitive features and data within the application, maintaining security and integrity.

function decideSignupRole(role) { // Aaron.F: This function determines whether a given role is requestable during the signup process. It checks if the provided role is included in the REQUESTABLE_ROLES array. If the role is requestable, it returns true, indicating that the user can request this role during signup. If the role is not requestable, it returns false, indicating that the user cannot request this role during signup.
    return REQUESTABLE_ROLES.includes(role) 
    ? ALLOW
    : deny(400,"Choose a Farmer or Manager role to request. Admin role can only be assigned by an admin.");
}


/*Aaron F: Logic approving pending sign up admin cannot be granted here it will be promoted afterwards by existing admin*/
function decideApproval({ targetRole, emailVerified, newRole}) {
    if (targetRole !== PENDING) return deny(409, "Account has not verified the email address yet");
    if(!emailVerified) return deny(409, "Account has not verrified thier email yet.");
    if (!REQUESTABLE_ROLES.includes(newRole)){
        return deny(400, "Approve as Field worker or Manager, only Admins can promote Admins.")
    }
    return ALLOW;
}

/*Aaron F: Data Management, so if the sign up is rejected it deletes the user from the pending list, not sure how to stop multiple requests will look into it */
function decideReject({ targetRole }) {
    return targetRole === PENDING ? ALLOW : deny(409, "Only pending sign-ups can be rejected.");
}

/*Aaron F: Changing role of a existing account to worker manager or promoting to admin*/
function decideRoleChange({ actorUid, targetUid, targetRole, newRole, adminRole, adminCount }) {
    if (actorUid === targetUid) return deny(403, "Only the admin can change roles, please message the admin");
    if (!ASSiGNABLE_ROLES.includes(targetRole)) return deny(409, "Approve the account before changing its role");
    if (!ASSiGNABLE_ROLES.includes(newRole)) return deny(400, "Choose Farmer, Manager or Promote to Admin");
    if (newRole === targetRole) return deny(409, "Account's role is already set as this role");
    if (targetRole === "admin" && adminCount <= 1) {
        return deny(409, "There must always be at least one Admin, Promote another account before demoting this account");
    }
    return ALLOW;
}

/*Aaron F: Delete account, new sign in and admin logic*/
function decideSelfDelete ({ role, adminCount, authTimeSec, nowSec, recentSeconds}) {
    if (!authTimeSec || nowSec - authTimeSec > recentSeconds) {
        return deny(401, "Please enter your Password to confirm to delete your account");
    }
    if (role === "admin" && adminCount <= 1) {
        return deny(409, "You are the only Admin account!, Please promote another admin before you leave");
    }
    return ALLOW;
}


/* Aaron F: role policy is a set of rules that define how roles can be assigned and managed within the system. 
It ensures that only authorized users can request certain roles, and that the assignment of roles follows a predefined policy. 
This helps maintain the security and integrity of the application by preventing unauthorized access to sensitive features or data. 
The role policy can be customized based on the specific requirements of the application 
and can include rules for role hierarchy, role dependencies, and role approval processes. */