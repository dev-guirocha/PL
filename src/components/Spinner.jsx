import React from 'react';

const Spinner = ({ size = 32, color = '#166534', thickness = 4 }) => {
  return (
    <div
      className="spinner"
      style={{
        width: size,
        height: size,
        borderWidth: thickness,
        borderTopColor: color,
      }}
      aria-label="Carregando"
    />
  );
};

export default Spinner;
