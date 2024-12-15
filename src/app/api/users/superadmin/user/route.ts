/* eslint-disable @typescript-eslint/no-explicit-any */
import User from "@/models/user.model";
import { connectDB } from "@/app/lib/mongoose";
import z from "zod";
import jwt from "jsonwebtoken";
import { handleErrorResponse } from "@/app/handlers/errorHandler";
import axios from "axios";

const userSchema = z.object({
	firstname: z.string().min(2).max(50),
	lastname: z.string().min(2).max(50),
	email: z.string().email(),
	phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, "Invalid phone number"), // Regex for valid phone number format
	role: z.enum(["superadmin", "admin", "user"]).default("superadmin"),
	otp: z.string().min(6).max(6).optional(),
});

// while creating user, we will take all the details but the sign in button will be disabled until the user verifies the email
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
		const existingUser = await User.findOne({ email: data.email });
		if (existingUser) {
			return new Response(
				JSON.stringify({
					success: false,
					message: "Email already exists",
				}),
				{
					status: 409,
					headers: { "Content-Type": "application/json" },
				}
			);
		}

		if (!body.otp) {
			// If OTP is not provided, generate and send it
			await axios.post(`${process.env.URL}/api/otp/generate`, {
				email: data.email,
			});
			return new Response(
				JSON.stringify({
					success: true,
					message: "OTP sent to your email. Please verify.",
				}),
				{
					status: 200,
					headers: { "Content-Type": "application/json" },
				}
			);
		}

		// Verify the OTP
		const isOtpValid = await axios.post(`${process.env.URL}/api/otp/verify`, {
			email: data.email,
			otp: data.otp,
		});
		console.log(isOtpValid);
		if (!isOtpValid.data.success) {
			return new Response(
				JSON.stringify({
					success: false,
					message: "Invalid or expired OTP",
				}),
				{
					status: 400,
					headers: { "Content-Type": "application/json" },
				}
			);
		}

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
		const token = jwt.sign({ id }, secret, { expiresIn: "6h" });

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
