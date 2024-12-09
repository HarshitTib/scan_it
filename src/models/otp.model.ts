import mongoose from "mongoose";

const Otp = new mongoose.Schema(
	{
		email: { type: String, required: true },
		otpHash: { type: String, required: true },
		expiresAt: { type: Date, required: true },
	},
	{
		timestamps: true,
	}
);

export default mongoose.models.OTP || mongoose.model("OTP", Otp);
