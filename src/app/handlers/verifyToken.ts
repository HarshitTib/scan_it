import { UserRole } from "@/constants/userRole";
import jwt from "jsonwebtoken";

export function verifyToken(authorization: string | null): {
	id: string;
	role: string;
} {
	if (!authorization) {
		throw new Error("Authorization token is required");
	}

	const [type, token] = authorization.split(" ");
	if (type !== "Bearer" || !token) {
		throw new Error("Invalid authorization format");
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let decodedToken: any;
	let role: string = "";

	// Check against different roles
	if (process.env.ADMIN_JWT_SECRET) {
		try {
			decodedToken = jwt.verify(token, process.env.ADMIN_JWT_SECRET);
			role = UserRole.ADMIN;
		} catch {}
	}

	if (!decodedToken && process.env.MANAGER_JWT_SECRET) {
		try {
			decodedToken = jwt.verify(token, process.env.MANAGER_JWT_SECRET);
			role = UserRole.MANAGER;
		} catch {}
	}

	if (!decodedToken && process.env.SUPERADMIN_JWT_SECRET) {
		try {
			decodedToken = jwt.verify(token, process.env.SUPERADMIN_JWT_SECRET);
			role = UserRole.SUPERADMIN;
		} catch {}
	}

	if (!decodedToken) {
		throw new Error("Invalid or expired token");
	}

	return { id: decodedToken.id, role };
}
