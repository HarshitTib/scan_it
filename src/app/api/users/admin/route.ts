/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import User from "@/models/user.model";
import { connectDB } from "@/app/lib/mongoose";
import z from "zod";
import jwt from "jsonwebtoken";
import bycrpyt from "bcryptjs";
import { handleErrorResponse } from "@/app/handlers/errorHandler";
import axios from "axios";
import ApiResponseHandler from "@/app/handlers/apiResponseHandler";

// Updated phone validation to handle phone numbers as strings
const userSchema = z.object({
	firstname: z.string().min(2).max(50),
	lastname: z.string().min(2).max(50),
	email: z.string().email(),
	phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, "Invalid phone number"), // Regex for valid phone number format
	role: z.enum(["superadmin", "admin", "user"]).default("admin"),
	otp: z.string().optional(),
});

const updateSchema = z.object({
	firstname: z.string().min(2).max(50).optional(),
	lastname: z.string().min(2).max(50).optional(),
	phone: z
		.string()
		.regex(/^\+?[1-9]\d{1,14}$/, "Invalid phone number")
		.optional(),
});

// Schema for ID validation (used in GET, PUT, DELETE)
const idSchema = z.string().regex(/^[a-f\d]{24}$/i, "Invalid MongoDB ID");

export async function POST(req: any) {
	try {
		await connectDB();
		const body = await req.json(); // Accessing body from req
		const superadmintoken = req.headers.get("superadmintoken");
		console.log(superadmintoken);
		const superadminsecret = process.env.SUPER_ADMIN_JWT_SECRET;
		if (!superadmintoken) {
			return ApiResponseHandler(false, 401, "Super Admin Token is required");
		}
		if (!superadminsecret) {
			return ApiResponseHandler(
				false,
				500,
				"Super Admin JWT secret is not defined"
			);
		}

		const token1 = superadmintoken.split(" ")[1];

		const superadminid = jwt.verify(token1, superadminsecret);
		if (!superadminid) {
			return ApiResponseHandler(false, 401, "Invalid Super Admin Token");
		} else {
			const id = (superadminid as jwt.JwtPayload).id;
			const user = await User.findById(id);
			if (!user || user.deleted) {
				return ApiResponseHandler(false, 404, "Super Admin not found");
			}
		}

		const data = userSchema.parse(body); // Validating request body
		const existingUser = await User.findOne({ email: data.email });
		if (existingUser) {
			return ApiResponseHandler(false, 400, "Email already exists");
		}
		if (!body.otp) {
			try {
				const generateOTP = await axios.post(
					`${process.env.URL}/api/otp/generate`,
					{
						email: data.email,
					}
				);
				return ApiResponseHandler(
					true,
					200,
					"OTP sent to your email. Please verify."
				);
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
			return ApiResponseHandler(false, 500, "OTP not verified");
		}

		const response = await User.create(data); // Creating user in DB
		if (!response) {
			return ApiResponseHandler(false, 500, "User not created");
		}
		const secret = process.env.ADMIN_JWT_SECRET;
		if (!secret) {
			return ApiResponseHandler(false, 500, "JWT secret is not defined");
		}
		const id = response._id;
		const token = jwt.sign({ id }, secret, { expiresIn: "6h" });
		return ApiResponseHandler(true, 200, `Bearer ${token}`);
	} catch (error) {
		return handleErrorResponse(error);
	}
}

export async function GET(req: any) {
	try {
		await connectDB();
		const token = req.headers.get("token");
		if (!token) {
			return ApiResponseHandler(false, 401, "Sign In is required");
		}
		const secret = process.env.ADMIN_JWT_SECRET;
		if (!secret) {
			return ApiResponseHandler(false, 500, "JWT secret is not defined");
		}
		const bearerToken = token.split(" ")[1];
		const decodedToken = jwt.verify(bearerToken, secret);
		const id =
			typeof decodedToken !== "string" && "id" in decodedToken
				? decodedToken.id
				: null;

		if (id) {
			// Validate ID and fetch single user
			try {
				idSchema.parse(id);
			} catch (error) {
				return ApiResponseHandler(false, 400, error);
			}
			const user = await User.findById(id);
			if (!user || user.deleted) {
				return ApiResponseHandler(false, 404, "User not found");
			}
			return ApiResponseHandler(true, 200, user);
		}
	} catch (error) {
		return handleErrorResponse(error);
	}
}

export async function PUT(req: any) {
	try {
		await connectDB();
		const body = await req.json();
		const token = req.headers.get("token");
		if (!token) {
			return ApiResponseHandler(false, 401, "Sign In is required");
		}
		const secret = process.env.ADMIN_JWT_SECRET;
		if (!secret) {
			return ApiResponseHandler(false, 500, "JWT secret is not defined");
		}
		const bearerToken = token.split(" ")[1];
		const decodedToken = jwt.verify(bearerToken, secret);
		const id =
			typeof decodedToken !== "string" && "id" in decodedToken
				? decodedToken.id
				: null;

		if (!id) {
			return ApiResponseHandler(false, 400, "User ID is required");
		}

		const data = updateSchema.parse(body); // Validating request body

		const updatedUser = await User.findByIdAndUpdate(id, data, {
			new: true,
		});

		if (!updatedUser || updatedUser.deleted) {
			return ApiResponseHandler(false, 404, "User not found");
		}

		return ApiResponseHandler(true, 200, updatedUser);
	} catch (error) {
		return handleErrorResponse(error);
	}
}

export async function DELETE(req: any) {
	try {
		await connectDB();
		const token = req.headers.get("token");
		if (!token) {
			return ApiResponseHandler(false, 401, "Sign In is required");
		}
		const secret = process.env.ADMIN_JWT_SECRET;
		if (!secret) {
			return ApiResponseHandler(false, 500, "JWT secret is not defined");
		}
		const bearerToken = token.split(" ")[1];
		const decodedToken = jwt.verify(bearerToken, secret);
		const id =
			typeof decodedToken !== "string" && "id" in decodedToken
				? decodedToken.id
				: null;

		// const url = new URL(req.url);
		// const id = url.searchParams.get("id");

		// Validate ID
		idSchema.parse(id);

		const deletedUser = await User.findByIdAndUpdate(
			id,
			{ deleted: true },
			{ new: true }
		);
		if (!deletedUser) {
			return ApiResponseHandler(false, 404, "User not found");
		}
		return ApiResponseHandler(true, 200, "User deleted successfully");
	} catch (error) {
		return handleErrorResponse(error);
	}
}
