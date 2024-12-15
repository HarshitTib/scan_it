/* eslint-disable @typescript-eslint/no-explicit-any */
import TableModel from "@/models/table.model";
import { handleErrorResponse } from "@/app/handlers/errorHandler";
import { connectDB } from "@/app/lib/mongoose";
import ApiResponseHandler from "@/app/handlers/apiResponseHandler";
import { StatusCode } from "@/constants/statusCodes";

export async function GET(req: any) {
	try {
		await connectDB();
		const url = new URL(req.url);
		const restaurantId = url.searchParams.get("restaurantId");
		const tableNumber = url.searchParams.get("tableNumber");
		const tables = await TableModel.find({ restaurantId, tableNumber });
		return ApiResponseHandler(true, StatusCode.SUCCESS, tables);
	} catch (error) {
		return handleErrorResponse(error);
	}
}
