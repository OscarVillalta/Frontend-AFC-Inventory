// import type { ProjectionItem, ProductProjection } from "../../api/dashboard";

// import { useEffect, useMemo, useRef } from "react";
// import * as d3 from "d3";

// const MARGIN = { top: 30, right: 30, bottom: 50, left: 50 };

// type StackedAreaChartProps = {
//   width: number;
//   height: number;
//   data: { [key: string]: number }[];
//   keys: string[];
// };

// import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

// const generateAread = () => void

// // #endregion
// export const StackedAreaChart = ({
//     width,
//     height,
//     data,
//     keys
// }: StackedAreaChartProps) => {
//   return (
//     <AreaChart
//       style={{ width: '100%', maxWidth: width, maxHeight: height, aspectRatio: 1.618 }}
//       responsive
//       data={data}
//       margin={{
//         top: 20,
//         right: 0,
//         left: 0,
//         bottom: 0,
//       }}
//     >
//       <CartesianGrid strokeDasharray="3 3" />
//       <XAxis dataKey="name" niceTicks="snap125" />
//       <YAxis width="auto" niceTicks="snap125" />
//       <Tooltip />
//       <Area type="monotone" dataKey="uv" stackId="1" stroke="#8884d8" fill="#8884d8" />
//       <Area type="monotone" dataKey="pv" stackId="1" stroke="#82ca9d" fill="#82ca9d" />
//       <Area type="monotone" dataKey="amt" stackId="1" stroke="#ffc658" fill="#ffc658" />
//     </AreaChart>
//   );
// };

// export default StackedAreaChart;
