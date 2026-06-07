import { useEffect, useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer
} from "recharts";
import api from "../api";

const COLORS = [
  "#0088FE",
  "#00C49F",
  "#FFBB28",
  "#FF8042",
  "#AA66CC"
];

export default function ExpensesPieChart() {

  const [data, setData] = useState([]);

  useEffect(() => {

    api.get("/dashboard")
      .then((res) => {
        const dashboard = res.data;

        const formatted = Object.entries(
          dashboard.expensesByCategory
        ).map(([name, value]) => ({
          name,
          value
        }));

        setData(formatted);

      })
      .catch((err) => {
        console.error("Error fetching dashboard expenses:", err);
      });

  }, []);

  return (

    <div
      style={{
        background: "#fff",
        padding: "20px",
        borderRadius: "16px",
        marginTop: "20px"
      }}
    >

      <h2>🍕 Gastos por Categoria</h2>

      <ResponsiveContainer width="100%" height={300}>

        <PieChart>

          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            outerRadius={100}
            label
          >

            {data.map((entry, index) => (

              <Cell
                key={index}
                fill={COLORS[index % COLORS.length]}
              />

            ))}

          </Pie>

          <Tooltip />

          <Legend />

        </PieChart>

      </ResponsiveContainer>

    </div>
  );
}