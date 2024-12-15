/* eslint-disable @typescript-eslint/no-explicit-any */
import z from "zod";
import QRCode from "qrcode";
import TableModel from "@/models/table.model";
import { handleErrorResponse } from "@/app/handlers/errorHandler";
import { connectDB } from "@/app/lib/mongoose";
import ApiResponseHandler from "@/app/handlers/apiResponseHandler";
import { StatusCode } from "@/constants/statusCodes";

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
