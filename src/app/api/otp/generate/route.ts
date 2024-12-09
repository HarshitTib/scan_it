import { NextResponse } from "next/server";
import otpGenerator from "otp-generator";
import crypto from "crypto";
import nodemailer from "nodemailer";
import { connectDB } from "@/app/lib/mongoose";
import OTPModel from "@/models/otp.model";

const OTP_EXPIRATION_TIME = 15 * 60 * 1000;

async function sendEmail(to: string, otp: string) {
	const transporter = nodemailer.createTransport({
		service: "gmail",
		auth: {
			user: process.env.EMAIL_USER,
			pass: process.env.EMAIL_PASS,
		},
	});

	const mailOptions = {
		from: process.env.EMAIL_USER,
		to,
		subject: "Your OTP Code",
		text: `Your OTP code is ${otp}. It is valid for 15 minutes.`,
	};

	return transporter.sendMail(mailOptions);
}

export async function POST(req: Request) {
	const { email } = await req.json();

	if (!email) {
		return NextResponse.json(
			{ success: false, message: "Email is required" },
			{ status: 400 }
		);
	}

	const otp = otpGenerator.generate(6, {
		digits: true,
		upperCaseAlphabets: false,
		lowerCaseAlphabets: false,
		specialChars: false,
	});
	const expiresAt = Date.now() + OTP_EXPIRATION_TIME;

	const otpHash = crypto
		.createHmac("sha256", process.env.OTP_SECRET || "defaultSecret")
		.update(otp)
		.digest("hex");

	try {
		await connectDB();

		await OTPModel.create({ email, otpHash, expiresAt });
		// Send OTP via email

		await sendEmail(email, otp);

		return NextResponse.json({
			success: true,
			message: "OTP sent successfully",
		});
	} catch (error) {
		console.error("Error sending email:", error);
		return NextResponse.json(
			{ success: false, message: "Failed to send OTP email" },
			{ status: 500 }
		);
	}
}
