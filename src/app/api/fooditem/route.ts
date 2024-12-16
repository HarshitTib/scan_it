/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import FoodItem from "@/models/fooditem.model";
import { connectDB } from "@/app/lib/mongoose";
import z from "zod";
import Restaurant from "@/models/restaurant.model";
import { handleErrorResponse } from "@/app/handlers/errorHandler";
import jwt from "jsonwebtoken";
import ApiResponseHandler from "@/app/handlers/apiResponseHandler";
import { StatusCode } from "@/constants/statusCodes";
import { verifyToken } from "@/app/handlers/verifyToken";
import { UserRole } from "@/constants/userRole";

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

export async function POST(req: any) {
	try {
		await connectDB();
		const body = await req.json();
		const { restaurant, ...rest } = inputSchema.parse(body);
		const restuarantResponse = await Restaurant.findById(restaurant);
		if (!restuarantResponse || restuarantResponse.deleted) {
			return ApiResponseHandler(
				false,
				StatusCode.BAD_REQUEST,
				"Restaurant does not exist"
			);
		}
		let userInfo;
		const authorization = req.headers.get("authorization");
		try {
			userInfo = verifyToken(authorization);
		} catch (error: any) {
			return ApiResponseHandler(false, StatusCode.UNAUTHORIZED, error.message);
		}
		const { id, role } = userInfo;
		if (role == UserRole.ADMIN) {
			if (id !== restuarantResponse.owner.toString()) {
				return ApiResponseHandler(
					false,
					StatusCode.UNAUTHORIZED,
					"The following admin is not the owner of the restaurant"
				);
			}
		} else if (role == UserRole.MANAGER) {
			if (!restuarantResponse.manager.includes(id)) {
				return ApiResponseHandler(
					false,
					StatusCode.UNAUTHORIZED,
					"The following manager is not the manager of the restaurant"
				);
			}
		} else {
			return ApiResponseHandler(false, StatusCode.UNAUTHORIZED, "Unauthorized");
		}
		const foodItem = await FoodItem.findOne({
			title: rest.title,
			restaurant: restaurant,
		});
		if (foodItem) {
			return ApiResponseHandler(
				false,
				StatusCode.BAD_REQUEST,
				`FoodItem already exists for a given title ${rest.title}`
			);
		}
		const newFoodItem = await FoodItem.create(body);
		return ApiResponseHandler(true, StatusCode.SUCCESS, newFoodItem);
	} catch (error: any) {
		return handleErrorResponse(error);
	}
}

export async function PUT(req: any) {
	try {
		await connectDB();
		const body = await req.json();
		const authorization = req.headers.get("authorization");
		const { id, updates } = updateSchema.parse(body);
		const foodItem = await FoodItem.findById(id).populate("restaurant");
		if (!foodItem || foodItem.deleted) {
			return ApiResponseHandler(
				false,
				StatusCode.BAD_REQUEST,
				"FoodItem does not exist"
			);
		}
		if (!foodItem.restaurant || foodItem.restaurant.deleted) {
			return ApiResponseHandler(
				false,
				StatusCode.BAD_REQUEST,
				"Restaurant does not exist"
			);
		}
		let userInfo;
		try {
			userInfo = verifyToken(authorization);
		} catch (error: any) {
			return ApiResponseHandler(false, StatusCode.UNAUTHORIZED, error.message);
		}
		const { id: userId, role } = userInfo;
		if (role == UserRole.ADMIN) {
			if (userId !== foodItem.restaurant.owner.toString()) {
				return ApiResponseHandler(
					false,
					StatusCode.UNAUTHORIZED,
					"The following admin is not the owner of the restaurant"
				);
			}
		} else if (role == UserRole.MANAGER) {
			if (!foodItem.restaurant.manager.includes(userId)) {
				return ApiResponseHandler(
					false,
					StatusCode.UNAUTHORIZED,
					"The following manager is not the manager of the restaurant "
				);
			}
		} else {
			return ApiResponseHandler(false, StatusCode.UNAUTHORIZED, "Unauthorized");
		}

		const foodItemFind = await FoodItem.findOne({
			title: updates.title,
			restaurant: foodItem.restaurant._id,
		});
		if (foodItemFind) {
			return ApiResponseHandler(
				false,
				StatusCode.BAD_REQUEST,
				`FoodItem already exists for a given title ${updates.title}`
			);
		}

		const updatedFoodItem = await FoodItem.findByIdAndUpdate(id, updates, {
			new: true,
		});
		return ApiResponseHandler(true, StatusCode.SUCCESS, updatedFoodItem);
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
				return ApiResponseHandler(
					false,
					StatusCode.BAD_REQUEST,
					"FoodItem does not exist"
				);
			}
			return ApiResponseHandler(true, StatusCode.SUCCESS, foodItem);
		}
		if (restaurant) {
			const foodItems = await FoodItem.find({ restaurant });
			const foodItemsWhichIsNotDeleted = foodItems.filter((foodItem) => {
				return (
					!foodItem.deleted && foodItem.enabled && !foodItem.restaurant.deleted
				);
			});
			if (!foodItems || foodItems.length === 0) {
				return ApiResponseHandler(
					false,
					StatusCode.BAD_REQUEST,
					`FoodItems does not exist for a given restaurant ${restaurant}`
				);
			}
			return ApiResponseHandler(
				true,
				StatusCode.SUCCESS,
				foodItemsWhichIsNotDeleted
			);
		}
		const foodItems = await FoodItem.find();
		return ApiResponseHandler(true, StatusCode.SUCCESS, foodItems);
	} catch (error: any) {
		return handleErrorResponse(error);
	}
}

export async function DELETE(req: any) {
	try {
		await connectDB();
		const body = await req.json();
		const authorization = req.headers.get("authorization");
		const { id } = deleteSchema.parse(body);
		const foodItem = await FoodItem.findById(id).populate("restaurant");
		console.log(foodItem);
		if (!foodItem || foodItem.deleted) {
			return ApiResponseHandler(
				false,
				StatusCode.BAD_REQUEST,
				"FoodItem does not exist"
			);
		}
		if (!foodItem.restaurant || foodItem.restaurant.deleted) {
			return ApiResponseHandler(
				false,
				StatusCode.BAD_REQUEST,
				"Restaurant does not exist"
			);
		}
		let userInfo;
		try {
			userInfo = verifyToken(authorization);
		} catch (error: any) {
			return ApiResponseHandler(false, StatusCode.UNAUTHORIZED, error.message);
		}
		const { id: userId, role } = userInfo;
		if (role == UserRole.ADMIN) {
			if (userId !== foodItem.restaurant.owner.toString()) {
				return ApiResponseHandler(
					false,
					StatusCode.UNAUTHORIZED,
					"The following admin is not the owner of the restaurant"
				);
			}
		} else if (role == UserRole.MANAGER) {
			if (!foodItem.restaurant.manager.includes(userId)) {
				return ApiResponseHandler(
					false,
					StatusCode.UNAUTHORIZED,
					"The following manager is not the manager of the restaurant"
				);
			}
		} else {
			return ApiResponseHandler(false, StatusCode.UNAUTHORIZED, "Unauthorized");
		}
		const updatedFoodItem = await FoodItem.findByIdAndUpdate(
			id,
			{ deleted: true },
			{ new: true }
		);
		return ApiResponseHandler(true, StatusCode.SUCCESS, updatedFoodItem);
	} catch (error: any) {
		return handleErrorResponse(error);
	}
}
