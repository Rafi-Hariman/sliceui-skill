import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'ugw-kitchen-sink-table',
  templateUrl: './kitchen-sink-table.component.html',
  styleUrls: ['./kitchen-sink-table.component.scss']
})
export class KitchenSinkTableComponent implements OnInit {
  columns = [];
  records: Array<any> = [];
  searchOptions = true;
  limitOptions = true;
  actionColumn = true;
  checkboxColumn = false;
  radioColumn = false;
  footerInfo = true;
  paginationOptions = true;
  tableHeader = true;
  striped = true;
  actionTitle = 'Actions';

    this.columns = [
      {
        name: 'Code',
        prop: 'code',
      },
      {
        name: 'ID',
        prop: 'short_name',
      },
      {
        name: 'Name',
        prop: 'name',
      },
      {
        name: 'Location',
        prop: 'location',
      },
      {
        name: 'Site',
        prop: 'url',
      }
    ];
    this.records = [
      {
        code: '42',
        short_name: 'FTI',
        name: 'Fakultas Teknologi Industri',
        location: 'Kaliurang',
        url: 'https://fit.uii.ac.id',
        fakultas: ''
      },
      {
        code: '41',
        short_name: 'FIAI',
        name: 'Fakultas Ilmu Agama Islam',
        location: 'Kaliurang',
        url: 'https://fis.uii.ac.id',
        fakultas: ''
      },
