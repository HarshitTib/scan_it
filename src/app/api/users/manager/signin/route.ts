/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import User from "@/models/user.model";
import { connectDB } from "@/app/lib/mongoose";
import z from "zod";
import jwt from "jsonwebtoken";
import { handleErrorResponse } from "@/app/handlers/errorHandler";
import axios from "axios";

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
			return new Response(
				JSON.stringify({ success: false, message: "Email not found" }),
				{
					status: 404,
					headers: { "Content-Type": "application/json" },
				}
			);
		}
		if (!body.otp) {
			try {
				await axios.post(`${process.env.URL}/api/otp/generate`, {
					email: data.email,
				});
				return new Response(
					JSON.stringify({
						success: true,
						message: `OTP sent to the registered mail address: ${data.email}`,
					}),
					{
						status: 200,
						headers: { "Content-Type": "application/json" },
					}
				);
				// eslint-disable-next-line @typescript-eslint/no-unused-vars
			} catch (error) {
				return new Response(
					JSON.stringify({ success: false, message: "Invalid email" }),
					{
						status: 500,
						headers: { "Content-Type": "application/json" },
					}
				);
			}
		}
		try {
			await axios.post(`${process.env.URL}/api/otp/verify`, {
				email: data.email,
				otp: data.otp,
			});
		} catch (error) {
			return new Response(
				JSON.stringify({ success: false, message: "Invalid OTP" }),
				{
					status: 400,
					headers: { "Content-Type": "application/json" },
				}
			);
		}

		const secret = process.env.MANAGER_JWT_SECRET;
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
		const id = existingUser._id;
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
