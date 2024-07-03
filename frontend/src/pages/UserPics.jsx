import React from 'react';
import { Table, TableBody, TableCell, TableContainer, TableRow, Paper, Typography } from '@mui/material';

function UserPics() {
  return (
    <div>
      <h2>Geçmiş Uygulamar</h2>
      
      <TableContainer component={Paper}>
        <Table>
          <TableBody>
            <TableRow>
              <TableCell>
                <img src="https://via.placeholder.com/150" alt="MR Görüntüsü" />
              </TableCell>
              <TableCell>
                <Typography variant="body1">
                  Bu, beyin tümör tespiti için kullanılan bir MR görüntüsüdür.
                </Typography>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
    </div>
  );
}

export default UserPics;
