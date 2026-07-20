import type { ProductLogRow } from "./orderProductSummaries";
import "./orderTotalsPrint.css";

interface Props {
  rows: ProductLogRow[];
  customerName?: string | null;
  externalOrderNumber?: string | null;
  minRows?: number;
}

function MetaFieldRow({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  const isBlank = !value?.trim();
  return (
    <tr className="order-totals-print__meta-row">
      <td colSpan={6} className="order-totals-print__meta-field">
        <span className="order-totals-print__meta-label">{label}</span>
        <span
          className={`order-totals-print__meta-line${
            isBlank ? " order-totals-print__meta-line--blank" : ""
          }`}
        >
          {isBlank ? "\u00A0" : value}
        </span>
      </td>
    </tr>
  );
}

export default function OrderTotalsPrintSheet({
  rows,
  customerName,
  externalOrderNumber,
  minRows = 35,
}: Props) {
  const paddedRows = [...rows];
  while (paddedRows.length < minRows) {
    paddedRows.push({
      product_id: -paddedRows.length,
      part_number: "",
      description: "",
      total_count: 0,
    });
  }

  return (
    <div className="order-totals-print">
      <table className="order-totals-print__table">
        <tbody>
          <tr>
            <td colSpan={6} className="order-totals-print__title">
              TOTAL ORDER COUNT
            </td>
          </tr>

          <tr className="order-totals-print__spacer">
            <td colSpan={6} />
          </tr>

          <MetaFieldRow label="Technician Name:" />
          <MetaFieldRow label="Customer Name:" value={customerName} />
          <MetaFieldRow label="Order ID:" value={externalOrderNumber} />
          <MetaFieldRow label="Date:" />

          <tr className="order-totals-print__spacer">
            <td colSpan={6} />
          </tr>

          <tr>
            <td
              colSpan={2}
              className="order-totals-print__header order-totals-print__col-product"
            >
              Product Number
            </td>
            <td 
            colSpan={2}
            className="order-totals-print__header order-totals-print__col-description"
            >
              Description
            </td>
            <td className="order-totals-print__header order-totals-print__col-count">
              Total Count
            </td>
            <td className="order-totals-print__header order-totals-print__col-taken">
              Amount Taken
            </td>
          </tr>

          <tr className="order-totals-print__spacer">
            <td colSpan={6} />
          </tr>

          {paddedRows.map((row) => {
            const isBlank = !row.part_number;
            return (
              <tr key={row.product_id} className="order-totals-print__data">
                <td colSpan={2} className="order-totals-print__col-product">
                  {isBlank ? "" : row.part_number}
                </td>
                <td colSpan={2} className="order-totals-print__col-description">
                  {isBlank ? "" : row.description}
                </td>
                <td className="order-totals-print__col-count order-totals-print__data--center">
                  {isBlank ? "" : row.total_count}
                </td>
                <td className="order-totals-print__col-taken" />
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
