import { Role } from "@prisma/client";
export function isToolAuthorized(tool, userRole) {
    if (tool.permission === "ADMIN_ONLY") {
        return userRole === Role.ADMIN;
    }
    return true;
}
