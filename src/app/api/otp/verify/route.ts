import { NextResponse } from "next/server";
import crypto from "crypto";
import { connectDB } from "@/app/lib/mongoose";
import OTPModel from "@/models/otp.model";

export async function POST(req: Request) {
	const { email, otp } = await req.json();

	if (!email || !otp) {
		return NextResponse.json(
			{ success: false, message: "Email and OTP are required" },
			{ status: 400 }
		);
	}
	try {
		await connectDB();

		const userOtpRecord = await OTPModel.findOne({ email }).sort({
			createdAt: -1,
		});

		console.log(userOtpRecord);

		if (!userOtpRecord) {
			return NextResponse.json(
				{ success: false, message: "No OTP found for this email" },
				{ status: 404 }
			);
		}

		const { otpHash, expiresAt } = userOtpRecord;

		if (Date.now() > expiresAt) {
			return NextResponse.json(
				{ success: false, message: "OTP expired" },
				{ status: 400 }
			);
		}

		const computedHash = crypto
			.createHmac("sha256", process.env.OTP_SECRET || "defaultSecret")
			.update(otp)
			.digest("hex");

		if (computedHash !== otpHash) {
			return NextResponse.json(
				{ success: false, message: "Invalid OTP" },
				{ status: 400 }
			);
		}

		return NextResponse.json({
			success: true,
			message: "OTP verified successfully",
		});

		// eslint-disable-next-line @typescript-eslint/no-unused-vars
	} catch (error) {
		return NextResponse.json(
			{ success: false, message: "Error verifying OTP" },
			{ status: 500 }
		);
	}
}
