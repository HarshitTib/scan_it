/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import FoodItem from "@/models/fooditem.model";
import { connectDB } from "@/app/lib/mongoose";
import z, { ZodError } from "zod";
import Restaurant from "@/models/restaurant.model";
import { handleErrorResponse } from "@/app/handlers/errorHandler";
import jwt from "jsonwebtoken";

const inputSchema = z.object({
	title: z.string().min(2).max(50),
	description: z.string().optional(),
	price: z.number().min(1),
	image: z.string().optional(),
	enabled: z.boolean().optional(),
	veg: z.boolean().optional(),
	category: z.string().optional(),
	restaurant: z.string().regex(/^[a-fA-F0-9]{24}$/, "Invalid ObjectId format"),
});

const updateSchema = z.object({
	id: z.string().regex(/^[a-fA-F0-9]{24}$/, "Invalid ObjectId format"), // FoodItem ID
	updates: z.object({
		title: z.string().min(2).max(50).optional(),
		description: z.string().optional(),
		price: z.number().int().min(1).optional(),
		image: z.string().optional(),
		enabled: z.boolean().optional(),
		veg: z.boolean().optional(),
		category: z.string().optional(),
		deleted: z.boolean().optional(),
	}),
});

const deleteSchema = z.object({
	id: z.string().regex(/^[a-fA-F0-9]{24}$/, "Invalid ObjectId format"),
});

const getSchema = z.object({
	id: z
		.string()
		.regex(/^[a-fA-F0-9]{24}$/, "Invalid ObjectId format")
		.optional(),
	restaurant: z
		.string()
		.regex(/^[a-fA-F0-9]{24}$/, "Invalid ObjectId format")
		.optional(),
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function POST(req: any) {
	try {
		await connectDB();
		const body = await req.json();
		const { restaurant, ...rest } = inputSchema.parse(body);
		const restuarantResponse = await Restaurant.findById(restaurant);
		if (!restuarantResponse || restuarantResponse.deleted) {
			return new Response(
				JSON.stringify({ success: false, data: "Restaurant does not exist" }),
				{
					status: 400,
					headers: { "Content-Type": "application/json" },
				}
			);
		}
		const admintoken = req.headers.get("admintoken");
		const managertoken = req.headers.get("managertoken");
		if (!admintoken && !managertoken) {
			return new Response(
				JSON.stringify({ success: false, data: "Token should be provided" }),
				{
					status: 401,
					headers: { "Content-Type": "application/json" },
				}
			);
		}
		if (admintoken) {
			const secret = process.env.ADMIN_JWT_SECRET;
			if (!secret) {
				return new Response(
					JSON.stringify({ success: false, data: "Server Error" }),
					{
						status: 500,
						headers: { "Content-Type": "application/json" },
					}
				);
			}
			const token = admintoken.split(" ")[1];
			const adminid = jwt.verify(token, secret);
			const id = (adminid as jwt.JwtPayload).id;
			if (!adminid || id !== restuarantResponse.owner.toString()) {
				return new Response(
					JSON.stringify({ success: false, data: "Unauthorized" }),
					{
						status: 401,
						headers: { "Content-Type": "application/json" },
					}
				);
			}
		} else if (managertoken) {
			const secret = process.env.MANAGER_JWT_SECRET;
			if (!secret) {
				return new Response(
					JSON.stringify({ success: false, data: "Server Error" }),
					{
						status: 500,
						headers: { "Content-Type": "application/json" },
					}
				);
			}
			const token = managertoken.split(" ")[1];
			const managerid = jwt.verify(token, secret);
			const id = (managerid as jwt.JwtPayload).id;
			if (!managerid || !restuarantResponse.manager.includes(id)) {
				return new Response(
					JSON.stringify({ success: false, data: "Unauthorized" }),
					{
						status: 401,
						headers: { "Content-Type": "application/json" },
					}
				);
			}
		}
		const foodItem = await FoodItem.findOne({
			title: rest.title,
			restaurant: restaurant,
		});
		if (foodItem) {
			return new Response(
				JSON.stringify({
					success: false,
					data: `FoodItem already exists for a given title ${rest.title}`,
				}),
				{
					status: 400,
					headers: { "Content-Type": "application/json" },
				}
			);
		}
		const newFoodItem = await FoodItem.create(body);
		return new Response(JSON.stringify({ success: true, data: newFoodItem }), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	} catch (error: any) {
		return handleErrorResponse(error);
	}
}

export async function PUT(req: any) {
	try {
		await connectDB();
		const body = await req.json();
		const admintoken = req.headers.get("admintoken");
		const managertoken = req.headers.get("managertoken");
		const { id, updates } = updateSchema.parse(body);
		const foodItem = await FoodItem.findById(id).populate("restaurant");
		console.log(foodItem);
		if (!foodItem || foodItem.deleted) {
			return new Response(
				JSON.stringify({ success: false, data: "FoodItem does not exist" }),
				{
					status: 400,
					headers: { "Content-Type": "application/json" },
				}
			);
		}
		if (!foodItem.restaurant || foodItem.restaurant.deleted) {
			return new Response(
				JSON.stringify({ success: false, data: "Restaurant does not exist" }),
				{
					status: 400,
					headers: { "Content-Type": "application/json" },
				}
			);
		}
		if (!admintoken && !managertoken) {
			return new Response(
				JSON.stringify({ success: false, data: "Token should be provided" }),
				{
					status: 401,
					headers: { "Content-Type": "application/json" },
				}
			);
		}

		if (admintoken) {
			const secret = process.env.ADMIN_JWT_SECRET;
			if (!secret) {
				return new Response(
					JSON.stringify({ success: false, data: "Server Error" }),
					{
						status: 500,
						headers: { "Content-Type": "application/json" },
					}
				);
			}
			const token = admintoken.split(" ")[1];
			const adminid = jwt.verify(token, secret);
			const id = (adminid as jwt.JwtPayload).id;
			console.log(id);
			console.log(foodItem.restaurant.owner);
			if (!adminid || id !== foodItem.restaurant.owner.toString()) {
				return new Response(
					JSON.stringify({ success: false, data: "Unauthorized" }),
					{
						status: 401,
						headers: { "Content-Type": "application/json" },
					}
				);
			}
		}

		if (managertoken) {
			const secret = process.env.MANAGER_JWT_SECRET;
			if (!secret) {
				return new Response(
					JSON.stringify({ success: false, data: "Server Error" }),
					{
						status: 500,
						headers: { "Content-Type": "application/json" },
					}
				);
			}
			const token = managertoken.split(" ")[1];
			const managerid = jwt.verify(token, secret);
			const id = (managerid as jwt.JwtPayload).id;
			if (!managerid || !foodItem.restaurant.manager.includes(id)) {
				return new Response(
					JSON.stringify({ success: false, data: "Unauthorized" }),
					{
						status: 401,
						headers: { "Content-Type": "application/json" },
					}
				);
			}
		}

		const foodItemFind = await FoodItem.findOne({
			title: updates.title,
			restaurant: foodItem.restaurant._id,
		});
		if (foodItemFind) {
			return new Response(
				JSON.stringify({
					success: false,
					data: `FoodItem already exists for a given title ${updates.title}`,
				}),
				{
					status: 400,
					headers: { "Content-Type": "application/json" },
				}
			);
		}

		const updatedFoodItem = await FoodItem.findByIdAndUpdate(id, updates, {
			new: true,
		});
		return new Response(
			JSON.stringify({ success: true, data: updatedFoodItem }),
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
		const id = url.searchParams.get("id");
		const restaurant = url.searchParams.get("restaurant");
		if (id) {
			const foodItem = await FoodItem.findById(id).populate("restaurant");
			if (!foodItem || foodItem.deleted) {
				return new Response(
					JSON.stringify({ success: false, data: "FoodItem does not exist" }),
					{
						status: 400,
						headers: { "Content-Type": "application/json" },
					}
				);
			}
			return new Response(JSON.stringify({ success: true, data: foodItem }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
		}
		if (restaurant) {
			const foodItems = await FoodItem.find({ restaurant });
			const foodItemsWhichIsNotDeleted = foodItems.filter((foodItem) => {
				return (
					!foodItem.deleted && foodItem.enabled && !foodItem.restaurant.deleted
				);
			});
			if (!foodItems || foodItems.length === 0) {
				return new Response(
					JSON.stringify({
						success: false,
						data: `FoodItems does not exist for a given restaurant ${restaurant}`,
					}),
					{
						status: 400,
						headers: { "Content-Type": "application/json" },
					}
				);
			}
			return new Response(
				JSON.stringify({ success: true, data: foodItemsWhichIsNotDeleted }),
				{
					status: 200,
					headers: { "Content-Type": "application/json" },
				}
			);
		}
		const foodItems = await FoodItem.find();
		return new Response(JSON.stringify({ success: true, data: foodItems }), {
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
		const admintoken = req.headers.get("admintoken");
		const managertoken = req.headers.get("managertoken");
		const { id } = deleteSchema.parse(body);
		const foodItem = await FoodItem.findById(id).populate("restaurant");
		console.log(foodItem);
		if (!foodItem || foodItem.deleted) {
			return new Response(
				JSON.stringify({ success: false, data: "FoodItem does not exist" }),
				{
					status: 400,
					headers: { "Content-Type": "application/json" },
				}
			);
		}
		if (!foodItem.restaurant || foodItem.restaurant.deleted) {
			return new Response(
				JSON.stringify({ success: false, data: "Restaurant does not exist" }),
				{
					status: 400,
					headers: { "Content-Type": "application/json" },
				}
			);
		}
		if (!admintoken && !managertoken) {
			return new Response(
				JSON.stringify({ success: false, data: "Token should be provided" }),
				{
					status: 401,
					headers: { "Content-Type": "application/json" },
				}
			);
		}
		if (admintoken) {
			const secret = process.env.ADMIN_JWT_SECRET;
			if (!secret) {
				return new Response(
					JSON.stringify({ success: false, data: "Server Error" }),
					{
						status: 500,
						headers: { "Content-Type": "application/json" },
					}
				);
			}
			const token = admintoken.split(" ")[1];
			const adminid = jwt.verify(token, secret);
			const id = (adminid as jwt.JwtPayload).id;
			if (!adminid || id !== foodItem.restaurant.owner.toString()) {
				return new Response(
					JSON.stringify({ success: false, data: "Unauthorized" }),
					{
						status: 401,
						headers: { "Content-Type": "application/json" },
					}
				);
			}
		}
		if (managertoken) {
			const secret = process.env.MANAGER_JWT_SECRET;
			if (!secret) {
				return new Response(
					JSON.stringify({ success: false, data: "Server Error" }),
					{
						status: 500,
						headers: { "Content-Type": "application/json" },
					}
				);
			}
			const token = managertoken.split(" ")[1];
			const managerid = jwt.verify(token, secret);
			const id = (managerid as jwt.JwtPayload).id;
			if (!managerid || !foodItem.restaurant.manager.includes(id)) {
				return new Response(
					JSON.stringify({ success: false, data: "Unauthorized" }),
					{
						status: 401,
						headers: { "Content-Type": "application/json" },
					}
				);
			}
		}
		const updatedFoodItem = await FoodItem.findByIdAndUpdate(
			id,
			{ deleted: true },
			{ new: true }
		);
		return new Response(
			JSON.stringify({ success: true, data: updatedFoodItem }),
			{
				status: 200,
				headers: { "Content-Type": "application/json" },
			}
		);
	} catch (error: any) {
		return handleErrorResponse(error);
	}
}
