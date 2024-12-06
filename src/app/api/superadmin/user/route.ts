/* eslint-disable @typescript-eslint/no-explicit-any */
import User from "@/models/user.model";
import { connectDB } from "@/app/lib/mongoose";
import z from "zod";
import jwt from "jsonwebtoken";
import bycrypt from "bcryptjs";
import { handleErrorResponse } from "@/app/handlers/errorHandler";

const userSchema = z.object({
	firstname: z.string().min(2).max(50),
	password: z.string().min(6),
	lastname: z.string().min(2).max(50),
	email: z.string().email(),
	phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, "Invalid phone number"), // Regex for valid phone number format
	role: z.enum(["superadmin", "admin", "user"]).default("superadmin"),
});

export async function POST(req: any) {
	try {
		await connectDB();
		const body = await req.json(); // Accessing body from req
		const { verificationCode, ...rest } = body;
		if (verificationCode !== process.env.VERIFICATION_CODE) {
			return new Response(
				JSON.stringify({
					success: false,
					message: "Invalid verification code",
				}),
				{
					status: 401,
					headers: { "Content-Type": "application/json" },
				}
			);
		}

		const data = userSchema.parse(rest); // Validating request body
		const password = data.password;
		const hashedPassword = bycrypt.hashSync(password, 10);
		data.password = hashedPassword;

		const response = await User.create(data); // Creating user in DB
		if (!response) {
			return new Response(
				JSON.stringify({ success: false, message: "User not created" }),
				{
					status: 500,
					headers: { "Content-Type": "application/json" },
				}
			);
		}
		const secret = process.env.SUPER_ADMIN_JWT_SECRET;
		if (!secret) {
			return new Response(
				JSON.stringify({
					success: false,
					message: "JWT secret is not defined",
				}),
				{
					status: 500,
					headers: { "Content-Type": "application/json" },
				}
			);
		}
		const id = response._id;
		const token = jwt.sign({ id }, secret);

		return new Response(
			JSON.stringify({ success: true, message: `Bearer ${token}` }),
			{
				status: 200,
				headers: { "Content-Type": "application/json" },
			}
		);
	} catch (error) {
		return handleErrorResponse(error);
	}
}
