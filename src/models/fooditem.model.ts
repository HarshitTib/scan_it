import mongoose from "mongoose";
import Restaurant from "@/models/restaurant.model";  // Assuming User is the correct path to your User model

const FoodItemSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String },
    price: { type: Number, required: true },
    image: { type: String },
    enabled: { type: Boolean, default: true },
    veg: { type: Boolean, default: true },
    category: { type: String, enum: ["Starters", "Mains", "Desserts", "Beverages"], default: "Mains", required: true },
    deleted: { type: Boolean, default: false },
    restaurant: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: Restaurant,
      required: true
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.models.FoodItem || mongoose.model("FoodItem", FoodItemSchema);
