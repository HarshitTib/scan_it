/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import Restaurant from "@/models/restaurant.model";
import { connectDB } from "@/app/lib/mongoose";
import z, { ZodError } from "zod";
import User from "@/models/user.model";
import jwt from "jsonwebtoken";
import { handleErrorResponse } from "@/app/handlers/errorHandler";
import axios from "axios";

const inputSchema = z.object({
	owneremail: z.string().email(),
	name: z.string().min(2).max(50),
	address1: z.string().min(2).max(50),
	address2: z.string().optional(),
	city: z.string().min(2).max(50),
	state: z.string().min(2).max(50),
	pincode: z.number().int().min(100000).max(999999), // Example: Indian pincode range
	country: z.string().min(2).max(50),
	gstin: z.string().min(2).max(50).optional(),
	manager: z
		.string()
		.regex(/^[a-fA-F0-9]{24}$/, "Invalid ObjectId format")
		.optional(),
	owner: z
		.string()
		.regex(/^[a-fA-F0-9]{24}$/, "Invalid ObjectId format")
		.optional(),
	otp: z.string().min(6).max(6).optional(),
});

const updateSchema = z.object({
	id: z.string().regex(/^[a-fA-F0-9]{24}$/, "Invalid ObjectId format"), // Restaurant ID
	updates: z.object({
		name: z.string().min(2).max(50).optional(),
		address1: z.string().min(2).max(50).optional(),
		address2: z.string().optional(),
		city: z.string().min(2).max(50).optional(),
		state: z.string().min(2).max(50).optional(),
		pincode: z.number().int().min(100000).max(999999).optional(),
		country: z.string().min(2).max(50).optional(),
		gstin: z.string().min(2).max(50).optional(),
		manager: z
			.string()
			.regex(/^[a-fA-F0-9]{24}$/, "Invalid ObjectId format")
			.optional(),
	}),
});

const deleteSchema = z.object({
	id: z.string().regex(/^[a-fA-F0-9]{24}$/, "Invalid ObjectId format"), // Restaurant ID
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function POST(req: any) {
	try {
		await connectDB();
		const body = await req.json();
		const superAdminToken = req.headers.get("superadmintoken").split(" ")[1];
		const superadminsecret = process.env.SUPER_ADMIN_JWT_SECRET;
		if (!superadminsecret) {
			return new Response(
				JSON.stringify({ success: false, data: "Server error" }),
				{
					status: 500,
					headers: { "Content-Type": "application/json" },
				}
			);
		}
		const decoded = jwt.verify(superAdminToken, superadminsecret);
		if (!decoded) {
			return new Response(
				JSON.stringify({ success: false, data: "Invalid token" }),
				{
					status: 401,
					headers: { "Content-Type": "application/json" },
				}
			);
		}
		const data = inputSchema.parse(body);
		const owner = await User.findOne({ email: data.owneremail });
		if (!owner || owner.deleted || owner.role !== "admin") {
			return new Response(
				JSON.stringify({ success: false, data: "Owner not found" }),
				{
					status: 404,
					headers: { "Content-Type": "application/json" },
				}
			);
		}
		if (!body.otp) {
			try {
				await axios.post(`${process.env.URL}/api/otp/generate`, {
					email: data.owneremail,
				});
				return new Response(
					JSON.stringify({ success: true, data: "OTP sent successfully" }),
					{
						status: 200,
						headers: { "Content-Type": "application/json" },
					}
				);
			} catch (error) {
				return new Response(
					JSON.stringify({ success: false, data: "Error in sending OTP" }),
					{
						status: 500,
						headers: { "Content-Type": "application/json" },
					}
				);
			}
		}
		try {
			await axios.post(`${process.env.URL}/api/otp/verify`, {
				email: data.owneremail,
				otp: body.otp,
			});
		} catch (error) {
			return new Response(
				JSON.stringify({ success: false, data: "Invalid OTP" }),
				{
					status: 401,
					headers: { "Content-Type": "application/json" },
				}
			);
		}

		data.owner = owner.id;

		const response = await Restaurant.create(data);
		return new Response(JSON.stringify({ success: true, data: response }), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	} catch (error) {
		return handleErrorResponse(error);
	}
}

export async function PUT(req: any) {
	try {
		await connectDB();
		const body = await req.json();
		const adminToken = req.headers.get("admintoken").split(" ")[1];
		const adminsecret = process.env.ADMIN_JWT_SECRET;
		if (!adminsecret) {
			return new Response(
				JSON.stringify({ success: false, data: "Server error" }),
				{
					status: 500,
					headers: { "Content-Type": "application/json" },
				}
			);
		}
		const decodedAdmin = jwt.verify(adminToken, adminsecret);
		if (!decodedAdmin) {
			return new Response(
				JSON.stringify({ success: false, data: "Invalid token" }),
				{
					status: 401,
					headers: { "Content-Type": "application/json" },
				}
			);
		}

		let adminId: string;
		if (typeof decodedAdmin !== "string" && "id" in decodedAdmin) {
			adminId = decodedAdmin.id;
		} else {
			return new Response(
				JSON.stringify({ success: false, data: "Invalid token" }),
				{
					status: 401,
					headers: { "Content-Type": "application/json" },
				}
			);
		}

		const { id, updates } = updateSchema.parse(body);
		const restaurant = await Restaurant.findById(id);
		if (!restaurant || restaurant.owner.toString() !== adminId) {
			return new Response(
				JSON.stringify({ success: false, message: "Restaurant not found" }),
				{
					status: 404,
					headers: { "Content-Type": "application/json" },
				}
			);
		}

		// Update the restaurant with the provided updates
		const updatedRestaurant = await Restaurant.findByIdAndUpdate(id, updates, {
			new: true,
		}).populate("owner");
		if (!updatedRestaurant || updatedRestaurant.deleted) {
			return new Response(
				JSON.stringify({ success: false, message: "Restaurant not found" }),
				{
					status: 404,
					headers: { "Content-Type": "application/json" },
				}
			);
		}

		return new Response(
			JSON.stringify({ success: true, data: updatedRestaurant }),
			{
				status: 200,
				headers: { "Content-Type": "application/json" },
			}
		);
	} catch (error: any) {
		return handleErrorResponse(error);
	}
}

export async function GET(req: any) {
	try {
		await connectDB();

		const url = new URL(req.url);
		const id = url.searchParams.get("id"); // Optional: Fetch a specific restaurant by ID

		if (id) {
			const restaurant = await Restaurant.findById(id).populate("owner");
			if (!restaurant || restaurant.deleted) {
				return new Response(
					JSON.stringify({ success: false, message: "Restaurant not found" }),
					{
						status: 404,
						headers: { "Content-Type": "application/json" },
					}
				);
			}
			return new Response(JSON.stringify({ success: true, data: restaurant }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
		}

		const restaurants = await Restaurant.find().populate("owner");
		return new Response(JSON.stringify({ success: true, data: restaurants }), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	} catch (error: any) {
		return handleErrorResponse(error);
	}
}

export async function DELETE(req: any) {
	try {
		await connectDB();
		const body = await req.json();
		const { id } = deleteSchema.parse(body);
		const adminToken = req.headers.get("admintoken")
			? req.headers.get("admintoken").split(" ")[1]
			: "";
		if (!adminToken) {
			return new Response(
				JSON.stringify({ success: false, data: "Invalid token" }),
				{
					status: 401,
					headers: { "Content-Type": "application/json" },
				}
			);
		}
		const adminsecret = process.env.ADMIN_JWT_SECRET;
		if (!adminsecret) {
			return new Response(
				JSON.stringify({ success: false, data: "Server error" }),
				{
					status: 500,
					headers: { "Content-Type": "application/json" },
				}
			);
		}
		const decodedAdmin = jwt.verify(adminToken, adminsecret);
		if (!decodedAdmin) {
			return new Response(
				JSON.stringify({ success: false, data: "Invalid token" }),
				{
					status: 401,
					headers: { "Content-Type": "application/json" },
				}
			);
		}
		let adminid: string;
		if (typeof decodedAdmin !== "string" && "id" in decodedAdmin) {
			adminid = decodedAdmin.id;
		} else {
			return new Response(
				JSON.stringify({ success: false, data: "Invalid token" }),
				{
					status: 401,
					headers: { "Content-Type": "application/json" },
				}
			);
		}
		const restaurant = await Restaurant.findById(id);
		if (!restaurant || restaurant.owner.toString() !== adminid) {
			return new Response(
				JSON.stringify({ success: false, message: "Restaurant not found" }),
				{
					status: 404,
					headers: { "Content-Type": "application/json" },
				}
			);
		}

		const deletedRestaurant = await Restaurant.findByIdAndUpdate(
			id,
			{ deleted: true },
			{ new: true }
		);
		if (!deletedRestaurant) {
			return new Response(
				JSON.stringify({ success: false, message: "Restaurant not found" }),
				{
					status: 404,
					headers: { "Content-Type": "application/json" },
				}
			);
		}

		return new Response(
			JSON.stringify({
				success: true,
				data: `${deletedRestaurant.name} is deleted`,
			}),
			{
				status: 200,
				headers: { "Content-Type": "application/json" },
			}
		);
	} catch (error) {
		return handleErrorResponse(error);
	}
}
