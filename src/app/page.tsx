"use client";
import axios from "axios";
import { useState } from "react";

export default function Home() {
	const [data, setData] = useState("");

	console.log(data);

	const handleSubmit = async (e: { preventDefault: () => void; }) => {
		e.preventDefault();
		console.log("data", data);
		const response = await axios.post("/api/user", {
			newData: data,
		});
		setData("");
		console.log(response.data);
	};

	return (
		<div>
			<input
				type="text"
				name=""
				id="Name"
				value={data}
				onChange={(e) => setData(e.target.value)}
			/>
			<button onClick={handleSubmit}>Submit</button>
		</div>
	);
}
