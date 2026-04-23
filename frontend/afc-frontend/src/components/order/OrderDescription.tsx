import { isOutgoingType } from "../../constants/orderTypes";
import type { OrderType } from "../../constants/orderTypes";
import { AuthContext } from "../../context/authContextDef";
import { useAuth } from "../../hooks/useAuth";

interface Props {
  value: string;
  onChange: (value: string) => void;
  selectedItemsCount: number;
  onAllocateSelected: () => void;
  onCommitSelected: () => void;
  onCancelSelected: () => void;
  onRollbackSelected: () => void;
  disabled?: boolean;
  orderType: OrderType;
  disableAllocate?: boolean;
  disableCommit?: boolean;
  disableCancel?: boolean;
  disableRollback?: boolean;
  disableDescription?: boolean;
}

export default function OrderDescription({ 
  value, 
  onChange, 
  selectedItemsCount,
  onAllocateSelected,
  onCommitSelected,
  onCancelSelected,
  onRollbackSelected,
  disabled = false,
  orderType,
  disableAllocate = false,
  disableCommit = false,
  disableCancel = false,
  disableRollback = false,
  disableDescription = false,
}: Props) {
  const {hasPermission} = useAuth()
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm text-slate-700">
      <div className="text-sm font-semibold text-gray-800">
        Description
      </div>

      <textarea
        className="textarea textarea-bordered w-full mt-3 min-h-[120px]"
        placeholder="Order description..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disableDescription}
      />

      {hasPermission("orders:edit") && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="text-xs font-semibold text-blue-800 mb-2">
            Bulk Actions ({selectedItemsCount} selected)
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="btn btn-xs btn-primary"
              onClick={onAllocateSelected}
              disabled={disabled || disableAllocate}
            >
              {isOutgoingType(orderType) ? "Reserve Selected" : "Order Selected"}
            </button>
            <button
              className="btn btn-xs btn-success"
              onClick={onCommitSelected}
              disabled={disabled || disableCommit}
            >
              {isOutgoingType(orderType) ? "Fulfill Selected" : "Receive Selected"}
            </button>
            <button
              className="btn btn-xs btn-error"
              onClick={onCancelSelected}
              disabled={disabled || disableCancel}
            >
              Cancel Order
            </button>
            <button
              className="btn btn-xs btn-warning"
              onClick={onRollbackSelected}
              disabled={disabled || disableRollback}
            >
              Reverse Selected
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
