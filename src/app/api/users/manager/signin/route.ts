/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import User from "@/models/user.model";
import { connectDB } from "@/app/lib/mongoose";
import z from "zod";
import jwt from "jsonwebtoken";
import { handleErrorResponse } from "@/app/handlers/errorHandler";
import axios from "axios";
import ApiResponseHandler from "@/app/handlers/apiResponseHandler";

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
			return ApiResponseHandler(false, 404, "Email not found");
		}
		if (!body.otp) {
			try {
				await axios.post(`${process.env.URL}/api/otp/generate`, {
					email: data.email,
				});
				return ApiResponseHandler(
					true,
					200,
					`OTP sent to the registered mail address: ${data.email}`
				);
				// eslint-disable-next-line @typescript-eslint/no-unused-vars
			} catch (error) {
				return ApiResponseHandler(false, 500, "OTP not generated");
			}
		}
		try {
			await axios.post(`${process.env.URL}/api/otp/verify`, {
				email: data.email,
				otp: data.otp,
			});
		} catch (error) {
			return ApiResponseHandler(false, 400, "Invalid OTP");
		}

		const secret = process.env.MANAGER_JWT_SECRET;
		if (!secret) {
			return ApiResponseHandler(false, 500, "JWT secret is not defined");
		}
		const id = existingUser._id;
		const token = jwt.sign({ id }, secret, { expiresIn: "6h" });
		return ApiResponseHandler(true, 200, `Bearer ${token}`);
	} catch (error) {
		return handleErrorResponse(error);
	}
}
