/* eslint-disable @typescript-eslint/no-unused-vars */
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

const signInSchema = z.object({
	email: z.string().email(),
	otp: z.string().optional(),
});

export async function POST(req: any) {
	try {
		await connectDB();
		const body = await req.json(); // Accessing body from req
		const data = signInSchema.parse(body);
		await connectDB();
		const existingUser = await User.findOne({ email: data.email });
		if (!existingUser || existingUser.deleted) {
			return ApiResponseHandler(false, StatusCode.NOT_FOUND, "Email not found");
		}
		if (!body.otp) {
			try {
				await axios.post(`${process.env.URL}/api/otp/generate`, {
					email: data.email,
				});
				return ApiResponseHandler(
					true,
					StatusCode.SUCCESS,
					`OTP sent to the registered mail address: ${data.email}`
				);
			} catch (error) {
				return ApiResponseHandler(
					false,
					StatusCode.INTERNAL_SERVER_ERROR,
					"Invalid email"
				);
			}
		}
		try {
			await axios.post(`${process.env.URL}/api/otp/verify`, {
				email: data.email,
				otp: data.otp,
			});
		} catch (error) {
			return ApiResponseHandler(false, StatusCode.BAD_REQUEST, "Invalid OTP");
		}

		const secret = process.env.ADMIN_JWT_SECRET;
		if (!secret) {
			return ApiResponseHandler(
				false,
				StatusCode.INTERNAL_SERVER_ERROR,
				"JWT secret is not defined"
			);
		}
		const id = existingUser._id;
		const token = jwt.sign({ id }, secret, { expiresIn: ExpiryTime.JWT });
		return ApiResponseHandler(true, StatusCode.SUCCESS, `Bearer ${token}`);
	} catch (error) {
		return handleErrorResponse(error);
	}
}
