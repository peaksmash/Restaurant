import React from 'react';
import { TableIntroScreen } from './TableIntroScreen';

export function LoadingScreen() {
  return (
    <TableIntroScreen
      loading
      restaurantName="Restaurante"
      tableName="Tu mesa"
      onContinue={() => {}}
    />
  );
}
