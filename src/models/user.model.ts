import mongoose from "mongoose";

const User = new mongoose.Schema(
	{
		firstname: { type: String, required: true },
		lastname: { type: String, required: true },
		email: { type: String, required: true, unique: true },
		phone: { type: Number, required: true },
		role: {
			type: String,
			required: true,
			enum: ["superadmin", "admin", "user", "manager"],
			default: "user",
		},
		deleted: { type: Boolean, default: false },
	},
	{
		timestamps: true,
	}
);

export default mongoose.models.User || mongoose.model("User", User);
