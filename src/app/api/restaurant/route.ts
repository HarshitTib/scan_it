/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import Restaurant from "@/models/restaurant.model";
import { connectDB } from "@/app/lib/mongoose";
import z from "zod";
import User from "@/models/user.model";
import jwt from "jsonwebtoken";
import { handleErrorResponse } from "@/app/handlers/errorHandler";
import axios from "axios";
import ApiResponseHandler from "@/app/handlers/apiResponseHandler";

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
		managerEmail: z.string().email("Invalid email format").optional(),
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
			return ApiResponseHandler(false, 500, "Server error");
		}
		const decoded = jwt.verify(superAdminToken, superadminsecret);
		if (!decoded) {
			return ApiResponseHandler(false, 401, "Invalid token");
		}
		const data = inputSchema.parse(body);
		const owner = await User.findOne({ email: data.owneremail });
		if (!owner || owner.deleted || owner.role !== "admin") {
			return ApiResponseHandler(false, 404, "Owner not found");
		}
		if (!body.otp) {
			try {
				await axios.post(`${process.env.URL}/api/otp/generate`, {
					email: data.owneremail,
				});
				return ApiResponseHandler(true, 200, "OTP sent successfully");
			} catch (error) {
				return ApiResponseHandler(false, 500, "Error in sending OTP");
			}
		}
		try {
			await axios.post(`${process.env.URL}/api/otp/verify`, {
				email: data.owneremail,
				otp: body.otp,
			});
		} catch (error) {
			return ApiResponseHandler(false, 401, "Invalid OTP");
		}

		data.owner = owner.id;

		const response = await Restaurant.create(data);
		return ApiResponseHandler(true, 200, response);
	} catch (error) {
		return handleErrorResponse(error);
	}
}
export async function PUT(req: any) {
	try {
		await connectDB();
		const body = await req.json();
		const adminToken = req.headers.get("admintoken")?.split(" ")[1];
		const adminsecret = process.env.ADMIN_JWT_SECRET;
		if (!adminsecret) {
			return ApiResponseHandler(false, 500, "Server error");
		}
		const decodedAdmin = jwt.verify(adminToken, adminsecret);
		if (!decodedAdmin) {
			return ApiResponseHandler(false, 401, "Invalid token");
		}

		let adminId: string;
		if (typeof decodedAdmin !== "string" && "id" in decodedAdmin) {
			adminId = decodedAdmin.id;
		} else {
			return ApiResponseHandler(false, 401, "Invalid token");
		}

		const { id, updates } = updateSchema.parse(body);

		// Find the restaurant by ID
		const restaurant = await Restaurant.findById(id);
		if (!restaurant || restaurant.owner.toString() !== adminId) {
			return ApiResponseHandler(false, 404, "Restaurant not found");
		}
		console.log(updates.managerEmail);
		if (updates.managerEmail) {
			const manager = await User.findOne({ email: updates.managerEmail });
			if (!manager) {
				return ApiResponseHandler(false, 404, "Manager not found");
			}

			if (!restaurant.manager || !restaurant.manager.includes(manager._id)) {
				restaurant.manager.push(manager._id);
			}
		}

		Object.assign(restaurant, updates);
		const updatedRestaurant = await restaurant.save();
		return ApiResponseHandler(true, 200, updatedRestaurant);
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
				return ApiResponseHandler(false, 404, "Restaurant not found");
			}
			return ApiResponseHandler(true, 200, restaurant);
		}

		const restaurants = await Restaurant.find().populate("owner");
		return ApiResponseHandler(true, 200, restaurants);
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
			return ApiResponseHandler(false, 401, "Invalid token");
		}
		const adminsecret = process.env.ADMIN_JWT_SECRET;
		if (!adminsecret) {
			return ApiResponseHandler(false, 500, "Server error");
		}
		const decodedAdmin = jwt.verify(adminToken, adminsecret);
		if (!decodedAdmin) {
			return ApiResponseHandler(false, 401, "Invalid token");
		}
		let adminid: string;
		if (typeof decodedAdmin !== "string" && "id" in decodedAdmin) {
			adminid = decodedAdmin.id;
		} else {
			return ApiResponseHandler(false, 401, "Invalid token");
		}
		const restaurant = await Restaurant.findById(id);
		if (!restaurant || restaurant.owner.toString() !== adminid) {
			return ApiResponseHandler(false, 404, "Restaurant not found");
		}

		const deletedRestaurant = await Restaurant.findByIdAndUpdate(
			id,
			{ deleted: true },
			{ new: true }
		);
		if (!deletedRestaurant) {
			return ApiResponseHandler(false, 404, "Restaurant not found");
		}

		return ApiResponseHandler(
			true,
			200,
			`${deletedRestaurant.name} is deleted`
		);
	} catch (error) {
		return handleErrorResponse(error);
	}
}
