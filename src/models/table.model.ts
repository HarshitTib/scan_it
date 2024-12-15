import mongoose from "mongoose";

const TableSchema = new mongoose.Schema({
	restaurantId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: "Restaurant",
		required: true,
	},
	qrCode: { type: String, required: true },
	tableNumber: { type: Number, required: true },
	pin: { type: String, default: null }, // Temporarily stores generated PIN
	pinExpiry: { type: Date, default: null }, // Expiry time for the PIN
});

export default mongoose.models.Table || mongoose.model("Table", TableSchema);
