/* eslint-disable @typescript-eslint/no-explicit-any */
import z from "zod";
import QRCode from "qrcode";
import TableModel from "@/models/table.model";
import { handleErrorResponse } from "@/app/handlers/errorHandler";
import { connectDB } from "@/app/lib/mongoose";
import ApiResponseHandler from "@/app/handlers/apiResponseHandler";
import { StatusCode } from "@/constants/statusCodes";
import { verifyToken } from "@/app/handlers/verifyToken";
import { UserRole } from "@/constants/userRole";
import RestaurantModel from "@/models/restaurant.model";

export const tableSchema = z.object({
	restaurantId: z
		.string()
		.regex(/^[a-fA-F0-9]{24}$/, "Invalid ObjectId format"),
	numberOfTables: z.number(),
});

export async function POST(req: any) {
	try {
		await connectDB();
		const body = await req.json();
		const { restaurantId, numberOfTables } = tableSchema.parse(body);
		const restaurantInfo = await RestaurantModel.findById(
			restaurantId
		).populate("owner");
		console.log(restaurantInfo);
		if (!restaurantInfo) {
			return ApiResponseHandler(
				false,
				StatusCode.NOT_FOUND,
				"Restaurant not found"
			);
		}
		const authorization = req.headers.get("Authorization");
		let userInfo;
		try {
			userInfo = verifyToken(authorization);
		} catch (error: any) {
			return ApiResponseHandler(false, StatusCode.UNAUTHORIZED, error.message);
		}
		const { id, role } = userInfo;
		if (role == UserRole.ADMIN) {
			console.log(restaurantInfo.owner);
			if (id !== restaurantInfo.owner._id.toString()) {
				return ApiResponseHandler(
					false,
					StatusCode.UNAUTHORIZED,
					"The following admin is not the owner of the restaurant"
				);
			}
		} else if (role == UserRole.MANAGER) {
			if (!restaurantInfo.manager.includes(id)) {
				return ApiResponseHandler(
					false,
					StatusCode.UNAUTHORIZED,
					"The following manager is not the manager of the restaurant"
				);
			}
		} else {
			return ApiResponseHandler(false, StatusCode.UNAUTHORIZED, "Unauthorized");
		}
		const tables = Array(numberOfTables)
			.fill(0)
			.map((_, i) => i + 1);

		await TableModel.deleteMany({ restaurantId });

		tables.map(async (tableId) => {
			const qrUrl = `${process.env.URL}/restaurant/${restaurantId}/${tableId}`;
			const qrCode = await QRCode.toDataURL(qrUrl);
			await TableModel.create({
				restaurantId: restaurantId,
				qrCode: qrCode,
				tableNumber: tableId,
			});
		});
		return ApiResponseHandler(
			true,
			StatusCode.SUCCESS,
			"Tables generated successfully"
		);
	} catch (error) {
		return handleErrorResponse(error);
	}
}
