import React, {useState} from 'react';

export default function InputModal({isOpen, onClose, onConfirm, onClear, children}) {
    if (!isOpen) return null;
    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000
        }}>
            <div style={{background: 'white', padding: 20, borderRadius: 5, flexDirection: "column"}}>
                {children}
                <div style={{marginTop: 20, display: 'flex', justifyContent: 'space-between'}}>
                    <button onClick={onClose}>取消</button>
                    <button onClick={onClear}>回到本月
                    </button>
                    <button onClick={onConfirm}>确定
                    </button>
                </div>
            </div>
        </div>
    );
}