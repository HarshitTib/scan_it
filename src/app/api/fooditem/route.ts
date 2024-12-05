/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import FoodItem from "@/models/fooditem.model";
import { connectDB } from "@/app/lib/mongoose";
import z, { ZodError } from "zod";
import Restaurant from "@/models/restaurant.model";

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
		restaurant: z
			.string()
			.regex(/^[a-fA-F0-9]{24}$/, "Invalid ObjectId format")
			.optional(),
	}),
});

const deleteSchema = z.object({
	id: z.string().regex(/^[a-fA-F0-9]{24}$/, "Invalid ObjectId format"), // Restaurant ID
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
		const res = await Restaurant.findById(restaurant);
		if (!res || res.deleted) {
			return new Response(
				JSON.stringify({ success: false, data: "Restaurant does not exist" }),
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
		const { id, updates } = updateSchema.parse(body);
		const foodItem = await FoodItem.findById(id);
		if (!foodItem || foodItem.deleted) {
			return new Response(
				JSON.stringify({ success: false, data: "FoodItem does not exist" }),
				{
					status: 400,
					headers: { "Content-Type": "application/json" },
				}
			);
		}
		if (updates.restaurant) {
			const res = await Restaurant.findById(updates.restaurant);
			if (!res || res.deleted) {
				return new Response(
					JSON.stringify({ success: false, data: "Restaurant does not exist" }),
					{
						status: 400,
						headers: { "Content-Type": "application/json" },
					}
				);
			}
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
		const body = await req.json();
		const { id } = deleteSchema.parse(body);
		const foodItem = await FoodItem.findById(id);
		if (!foodItem) {
			return new Response(
				JSON.stringify({ success: false, data: "FoodItem does not exist" }),
				{
					status: 400,
					headers: { "Content-Type": "application/json" },
				}
			);
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
