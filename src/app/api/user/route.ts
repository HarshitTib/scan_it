/* eslint-disable @typescript-eslint/no-explicit-any */
import User from "@/models/user.model";
import { connectDB } from "@/app/lib/mongoose";
import z, { ZodError } from "zod";
import jwt from "jsonwebtoken";
import bycrpyt from "bcryptjs";

// Updated phone validation to handle phone numbers as strings
const userSchema = z.object({
	firstname: z.string().min(2).max(50),
	password: z.string().min(6),
	lastname: z.string().min(2).max(50),
	email: z.string().email(),
	phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, "Invalid phone number"), // Regex for valid phone number format
	role: z.enum(["superadmin", "admin", "user"]).default("admin"),
});

const updateSchema = z.object({
	firstname: z.string().min(2).max(50).optional(),
	lastname: z.string().min(2).max(50).optional(),
	email: z.string().email().optional(),
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
		console.log(body);
		const superadmintoken = req.headers.get("superadmintoken");
		console.log(superadmintoken);
		const superadminsecret = process.env.SUPER_ADMIN_JWT_SECRET;
		if (!superadmintoken) {
			return new Response(
				JSON.stringify({
					success: false,
					message: "Super Admin Token is required",
				}),
				{
					status: 401,
					headers: { "Content-Type": "application/json" },
				}
			);
		}

		if (!superadminsecret) {
			return new Response(
				JSON.stringify({
					success: false,
					message: "Super Admin JWT secret is not defined",
				}),
				{
					status: 500,
					headers: { "Content-Type": "application/json" },
				}
			);
		}

		const token1 = superadmintoken.split(" ")[1];

		const superadminid = jwt.verify(token1, superadminsecret) as jwt.JwtPayload;
		console.log(superadminid);
		if (!superadminid) {
			return new Response(
				JSON.stringify({
					success: false,
					message: "Invalid Super Admin Token",
				}),
				{
					status: 401,
					headers: { "Content-Type": "application/json" },
				}
			);
		} else {
			const id = (superadminid as jwt.JwtPayload).id;
			const user = await User.findById(id);
			if (!user || user.deleted) {
				return new Response(
					JSON.stringify({ success: false, message: "Super Admin not found" }),
					{
						status: 404,
						headers: { "Content-Type": "application/json" },
					}
				);
			}
		}

		const password = body.password;
		const salt = await bycrpyt.genSalt(10);
		body.password = await bycrpyt.hash(password, salt);
		console.log(body);

		const data = userSchema.parse(body); // Validating request body

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
		const secret = process.env.ADMIN_JWT_SECRET;
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
		if (error instanceof ZodError) {
			return new Response(
				JSON.stringify({
					success: false,
					message: "Validation Error",
					issues: error.errors, // Provide detailed validation errors
				}),
				{
					status: 400,
					headers: { "Content-Type": "application/json" },
				}
			);
		}
		return new Response(
			JSON.stringify({
				success: false,
				message: error instanceof Error ? error.message : String(error),
			}),
			{
				status: 500,
				headers: { "Content-Type": "application/json" },
			}
		);
	}
}

export async function GET(req: any) {
	try {
		await connectDB();
		const token = req.headers.get("token");
		if (!token) {
			return new Response(
				JSON.stringify({ success: false, message: "Sign In is required" }),
				{
					status: 401,
					headers: { "Content-Type": "application/json" },
				}
			);
		}
		const secret = process.env.ADMIN_JWT_SECRET;
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
				return new Response(
					JSON.stringify({ success: false, message: error }),
					{
						status: 400,
						headers: { "Content-Type": "application/json" },
					}
				);
			}
			const user = await User.findById(id);
			if (!user || user.deleted) {
				return new Response(
					JSON.stringify({ success: false, message: "User not found" }),
					{
						status: 404,
						headers: { "Content-Type": "application/json" },
					}
				);
			}
			return new Response(JSON.stringify({ success: true, message: user }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
		}
	} catch (error) {
		if (error instanceof ZodError) {
			return new Response(
				JSON.stringify({
					success: false,
					message: "Validation Error",
					issues: error.errors, // Provide detailed validation errors
				}),
				{
					status: 400,
					headers: { "Content-Type": "application/json" },
				}
			);
		}
		return new Response(
			JSON.stringify({
				success: false,
				message: error instanceof Error ? error.message : String(error),
			}),
			{
				status: 500,
				headers: { "Content-Type": "application/json" },
			}
		);
	}
}

export async function PUT(req: any) {
	try {
		await connectDB();
		const body = await req.json();
		const token = req.headers.get("token");
		if (!token) {
			return new Response(
				JSON.stringify({ success: false, message: "Sign In is required" }),
				{
					status: 401,
					headers: { "Content-Type": "application/json" },
				}
			);
		}
		const secret = process.env.ADMIN_JWT_SECRET;
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
		const bearerToken = token.split(" ")[1];
		const decodedToken = jwt.verify(bearerToken, secret);
		const id =
			typeof decodedToken !== "string" && "id" in decodedToken
				? decodedToken.id
				: null;

		if (!id) {
			return new Response(
				JSON.stringify({ success: false, message: "User ID is required" }),
				{
					status: 400,
					headers: { "Content-Type": "application/json" },
				}
			);
		}

		const data = updateSchema.parse(body); // Validating request body

		const updatedUser = await User.findByIdAndUpdate(id, data, {
			new: true,
		});

		if (!updatedUser || updatedUser.deleted) {
			return new Response(
				JSON.stringify({ success: false, message: "User not found" }),
				{
					status: 404,
					headers: { "Content-Type": "application/json" },
				}
			);
		}

		return new Response(
			JSON.stringify({ success: true, message: updatedUser }),
			{
				status: 200,
				headers: { "Content-Type": "application/json" },
			}
		);
	} catch (error) {
		if (error instanceof ZodError) {
			return new Response(
				JSON.stringify({
					success: false,
					message: "Validation Error",
					issues: error.errors, // Provide detailed validation errors
				}),
				{
					status: 400,
					headers: { "Content-Type": "application/json" },
				}
			);
		}
		return new Response(
			JSON.stringify({
				success: false,
				message: error instanceof Error ? error.message : String(error),
			}),
			{
				status: 500,
				headers: { "Content-Type": "application/json" },
			}
		);
	}
}

export async function DELETE(req: any) {
	try {
		await connectDB();
		const token = req.headers.get("token");
		if (!token) {
			return new Response(
				JSON.stringify({ success: false, message: "Sign In is required" }),
				{
					status: 401,
					headers: { "Content-Type": "application/json" },
				}
			);
		}
		const secret = process.env.ADMIN_JWT_SECRET;
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
			return new Response(
				JSON.stringify({ success: false, message: "User not found" }),
				{
					status: 404,
					headers: { "Content-Type": "application/json" },
				}
			);
		}

		return new Response(
			JSON.stringify({ success: true, message: "User deleted successfully" }),
			{
				status: 200,
				headers: { "Content-Type": "application/json" },
			}
		);
	} catch (error) {
		if (error instanceof ZodError) {
			return new Response(
				JSON.stringify({
					success: false,
					message: "Validation Error",
					issues: error.errors, // Provide detailed validation errors
				}),
				{
					status: 400,
					headers: { "Content-Type": "application/json" },
				}
			);
		}
		return new Response(
			JSON.stringify({
				success: false,
				message: error instanceof Error ? error.message : String(error),
			}),
			{
				status: 500,
				headers: { "Content-Type": "application/json" },
			}
		);
	}
}
