/* eslint-disable @typescript-eslint/no-explicit-any */
import User from "@/models/user.model";
import { connectDB } from "@/app/lib/mongoose";
import z from "zod";
import jwt from "jsonwebtoken";
import { handleErrorResponse } from "@/app/handlers/errorHandler";
import axios from "axios";

const signInSchema = z.object({
	email: z.string().email(),
	otp: z.string().min(6).max(6).optional(),
});

export async function POST(req: any) {
	try {
		await connectDB();
		const body = await req.json(); // Accessing body from req
		const data = signInSchema.parse(body);

		const response = await User.findOne({ email: data.email });
		if (!response || response.deleted) {
			return new Response(
				JSON.stringify({ success: false, message: "User not present" }),
				{
					status: 500,
					headers: { "Content-Type": "application/json" },
				}
			);
		}

		if (!data.otp) {
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

		if (data.otp) {
			console.log(data);
			try {
				await axios.post(`${process.env.URL}/api/otp/verify`, {
					email: data.email,
					otp: data.otp,
				});
				// eslint-disable-next-line @typescript-eslint/no-unused-vars
			} catch (error) {
				return new Response(
					JSON.stringify({ success: false, message: "Invalid OTP" }),
					{
						status: 400,
						headers: { "Content-Type": "application/json" },
					}
				);
			}
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
