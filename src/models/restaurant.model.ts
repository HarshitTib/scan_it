import mongoose from "mongoose";
import User from "@/models/user.model"; // Assuming User is the correct path to your User model

const RestaurantSchema = new mongoose.Schema(
	{
		name: { type: String, required: true },
		address1: { type: String, required: true },
		address2: { type: String },
		city: { type: String, required: true },
		state: { type: String, required: true },
		pincode: { type: Number, required: true },
		gstin: { type: String },
		restrict: { type: Boolean, default: false },
		deleted: { type: Boolean, default: false },
		owner: {
			type: mongoose.Schema.Types.ObjectId,
			ref: User,
		},
	},
	{
		timestamps: true,
	}
);

export default mongoose.models.Restaurant ||
	mongoose.model("Restaurant", RestaurantSchema);
