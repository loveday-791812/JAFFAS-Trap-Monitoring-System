"use strict";// Aaron.F: This file defines the roles that can be requested by users in the system. It exports an array of roles that are considered requestable, meaning that users can request these roles to be assigned to them. The roles are defined as strings and can be used throughout the application to manage user permissions and access control.

const PENDING = "pending";
const REQUESTABLE_ROLES = [
    "admin", // Aaron.F: Admin role can be requested by users, but it requires approval from an existing admin. Admins have full access to the system and can manage other users and their roles.
    "manager", // Aaron.F: Manager role can be requested by users, but it requires approval from an existing admin. Managers have elevated permissions to manage certain aspects of the system, such as overseeing specific projects or teams.
    "worker", // Aaron.F: Worker role can be requested by users and is typically granted automatically. Workers have standard access to the system's features and functionalities.
    PENDING // Aaron.F: Pending role is a temporary state for users who have requested a role but are awaiting approval. Users in this state have limited access until their request is reviewed and approved by an admin.
];



/* Aaron F: role policy is a set of rules that define how roles can be assigned and managed within the system. 
It ensures that only authorized users can request certain roles, and that the assignment of roles follows a predefined policy. 
This helps maintain the security and integrity of the application by preventing unauthorized access to sensitive features or data. 
The role policy can be customized based on the specific requirements of the application 
and can include rules for role hierarchy, role dependencies, and role approval processes. */