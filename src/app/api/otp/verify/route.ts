import crypto from "crypto";
import { connectDB } from "@/app/lib/mongoose";
import OTPModel from "@/models/otp.model";
import ApiResponseHandler from "@/app/handlers/apiResponseHandler";
import { StatusCode } from "@/constants/statusCodes";

export async function POST(req: Request) {
	const { email, otp } = await req.json();

	if (!email || !otp) {
		return ApiResponseHandler(
			false,
			StatusCode.BAD_REQUEST,
			"Email and OTP are required"
		);
	}
	try {
		await connectDB();

		const userOtpRecord = await OTPModel.findOne({ email }).sort({
			createdAt: -1,
		});

		if (!userOtpRecord) {
			return ApiResponseHandler(
				false,
				StatusCode.NOT_FOUND,
				"No OTP found for this email"
			);
		}

		const { otpHash, expiresAt } = userOtpRecord;

		if (Date.now() > expiresAt) {
			return ApiResponseHandler(false, StatusCode.BAD_REQUEST, "OTP expired");
		}

		const computedHash = crypto
			.createHmac("sha256", process.env.OTP_SECRET || "defaultSecret")
			.update(otp)
			.digest("hex");
		if (computedHash !== otpHash) {
			return ApiResponseHandler(false, StatusCode.BAD_REQUEST, "Invalid OTP");
		}

		return ApiResponseHandler(
			true,
			StatusCode.SUCCESS,
			"OTP verified successfully"
		);

		// eslint-disable-next-line @typescript-eslint/no-unused-vars
	} catch (error) {
		return ApiResponseHandler(
			false,
			StatusCode.INTERNAL_SERVER_ERROR,
			"Error verifying OTP"
		);
	}
}
