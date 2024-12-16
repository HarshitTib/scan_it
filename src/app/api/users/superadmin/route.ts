/* eslint-disable @typescript-eslint/no-explicit-any */
import User from "@/models/user.model";
import { connectDB } from "@/app/lib/mongoose";
import z from "zod";
import jwt from "jsonwebtoken";
import { handleErrorResponse } from "@/app/handlers/errorHandler";
import axios from "axios";
import ApiResponseHandler from "@/app/handlers/apiResponseHandler";
import { StatusCode } from "@/constants/statusCodes";
import { ExpiryTime } from "@/constants/expiryTime";

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
			return ApiResponseHandler(
				false,
				StatusCode.UNAUTHORIZED,
				"Invalid verification code"
			);
		}

		const data = userSchema.parse(rest); // Validating request body
		const existingUser = await User.findOne({ email: data.email });
		if (existingUser) {
			return ApiResponseHandler(
				false,
				StatusCode.CONFLICT,
				"Email already exists"
			);
		}

		if (!body.otp) {
			// If OTP is not provided, generate and send it
			await axios.post(`${process.env.URL}/api/otp/generate`, {
				email: data.email,
			});
			return ApiResponseHandler(
				true,
				StatusCode.SUCCESS,
				"OTP sent to your email. Please verify."
			);
		}

		// Verify the OTP
		const isOtpValid = await axios.post(`${process.env.URL}/api/otp/verify`, {
			email: data.email,
			otp: data.otp,
		});
		if (!isOtpValid.data.success) {
			return ApiResponseHandler(false, StatusCode.BAD_REQUEST, "Invalid OTP");
		}

		const response = await User.create(data); // Creating user in DB
		if (!response) {
			return ApiResponseHandler(
				false,
				StatusCode.INTERNAL_SERVER_ERROR,
				"User not created"
			);
		}
		const secret = process.env.SUPER_ADMIN_JWT_SECRET;
		if (!secret) {
			return ApiResponseHandler(
				false,
				StatusCode.INTERNAL_SERVER_ERROR,
				"JWT secret is not defined"
			);
		}
		const id = response._id;
		const token = jwt.sign({ id }, secret, { expiresIn: ExpiryTime.JWT });
		return ApiResponseHandler(true, StatusCode.SUCCESS, `Bearer ${token}`);
	} catch (error) {
		return handleErrorResponse(error);
	}
}
