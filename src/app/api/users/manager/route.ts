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

// Updated phone validation to handle phone numbers as strings
const userSchema = z.object({
	firstname: z.string().min(2).max(50),
	lastname: z.string().min(2).max(50),
	email: z.string().email(),
	phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, "Invalid phone number"), // Regex for valid phone number format
	role: z.enum(["superadmin", "admin", "user", "manager"]).default("manager"),
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
		const admintoken = req.headers.get("admintoken");
		console.log(admintoken);
		const adminsecret = process.env.ADMIN_JWT_SECRET;
		if (!admintoken) {
			return ApiResponseHandler(
				false,
				StatusCode.UNAUTHORIZED,
				"Admin Token is required"
			);
		}
		if (!adminsecret) {
			return ApiResponseHandler(
				false,
				StatusCode.INTERNAL_SERVER_ERROR,
				"Admin JWT secret is not defined"
			);
		}

		const token1 = admintoken.split(" ")[1];
		console.log(token1);

		const adminid = jwt.verify(token1, adminsecret);
		if (!adminid) {
			return ApiResponseHandler(
				false,
				StatusCode.UNAUTHORIZED,
				"Invalid Admin Token"
			);
		} else {
			const id = (adminid as jwt.JwtPayload).id;
			console.log(id);
			const user = await User.findById(id);
			if (!user || user.deleted) {
				return ApiResponseHandler(
					false,
					StatusCode.NOT_FOUND,
					"Admin not found"
				);
			}
		}

		const data = userSchema.parse(body); // Validating request body
		const existingUser = await User.findOne({ email: data.email });
		if (existingUser) {
			return ApiResponseHandler(
				false,
				StatusCode.BAD_REQUEST,
				"Email already exists"
			);
		}
		if (!body.otp) {
			try {
				await axios.post(`${process.env.URL}/api/otp/generate`, {
					email: data.email,
				});
				return ApiResponseHandler(
					true,
					StatusCode.SUCCESS,
					"OTP sent to your email. Please verify."
				);
			} catch (error) {
				return ApiResponseHandler(
					false,
					StatusCode.INTERNAL_SERVER_ERROR,
					"OTP not generated"
				);
			}
		}

		try {
			await axios.post(`${process.env.URL}/api/otp/verify`, {
				email: data.email,
				otp: data.otp,
			});
		} catch (error) {
			return ApiResponseHandler(
				false,
				StatusCode.BAD_REQUEST,
				"OTP not verified"
			);
		}

		const response = await User.create(data); // Creating user in DB
		if (!response) {
			return ApiResponseHandler(
				false,
				StatusCode.INTERNAL_SERVER_ERROR,
				"User not created"
			);
		}
		const secret = process.env.MANAGER_JWT_SECRET;
		if (!secret) {
			return ApiResponseHandler(
				false,
				StatusCode.INTERNAL_SERVER_ERROR,
				"JWT secret is not defined"
			);
		}
		const id = response._id;
		const token = jwt.sign({ id }, secret, { expiresIn: "6h" });
		return ApiResponseHandler(true, StatusCode.SUCCESS, `Bearer ${token}`);
	} catch (error) {
		return handleErrorResponse(error);
	}
}

export async function GET(req: any) {
	try {
		await connectDB();
		const token = req.headers.get("token");
		console.log(token);
		if (!token) {
			return ApiResponseHandler(
				false,
				StatusCode.UNAUTHORIZED,
				"Sign In is required"
			);
		}
		const secret = process.env.MANAGER_JWT_SECRET;
		if (!secret) {
			return ApiResponseHandler(
				false,
				StatusCode.INTERNAL_SERVER_ERROR,
				"JWT secret is not defined"
			);
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
				return ApiResponseHandler(false, StatusCode.BAD_REQUEST, error);
			}
			const user = await User.findById(id);
			if (!user || user.deleted) {
				return ApiResponseHandler(
					false,
					StatusCode.NOT_FOUND,
					"User not found"
				);
			}
			return ApiResponseHandler(true, StatusCode.SUCCESS, user);
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
			return ApiResponseHandler(
				false,
				StatusCode.UNAUTHORIZED,
				"Sign In is required"
			);
		}
		const secret = process.env.MANAGER_JWT_SECRET;
		if (!secret) {
			return ApiResponseHandler(
				false,
				StatusCode.INTERNAL_SERVER_ERROR,
				"JWT secret is not defined"
			);
		}
		const bearerToken = token.split(" ")[1];
		const decodedToken = jwt.verify(bearerToken, secret);
		const id =
			typeof decodedToken !== "string" && "id" in decodedToken
				? decodedToken.id
				: null;

		if (!id) {
			return ApiResponseHandler(
				false,
				StatusCode.BAD_REQUEST,
				"User ID is required"
			);
		}

		const data = updateSchema.parse(body); // Validating request body

		const updatedUser = await User.findByIdAndUpdate(id, data, {
			new: true,
		});

		if (!updatedUser || updatedUser.deleted) {
			return ApiResponseHandler(false, StatusCode.NOT_FOUND, "User not found");
		}

		return ApiResponseHandler(true, StatusCode.SUCCESS, updatedUser);
	} catch (error) {
		return handleErrorResponse(error);
	}
}

export async function DELETE(req: any) {
	try {
		await connectDB();
		const token = req.headers.get("token");
		if (!token) {
			return ApiResponseHandler(
				false,
				StatusCode.UNAUTHORIZED,
				"Sign In is required"
			);
		}
		const secret = process.env.MANAGER_JWT_SECRET;
		if (!secret) {
			return ApiResponseHandler(
				false,
				StatusCode.INTERNAL_SERVER_ERROR,
				"JWT secret is not defined"
			);
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
			return ApiResponseHandler(false, StatusCode.NOT_FOUND, "User not found");
		}

		return ApiResponseHandler(
			true,
			StatusCode.SUCCESS,
			"User deleted successfully"
		);
	} catch (error) {
		return handleErrorResponse(error);
	}
}
