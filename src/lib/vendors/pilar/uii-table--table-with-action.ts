import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'ugw-table-with-action',
  templateUrl: './table-with-action.component.html',
  styleUrls: ['./table-with-action.component.scss']
})
export class TableWithActionComponent implements OnInit {

  rows: Array<any> = [];
  columns: Array<any> = [];
  actionSelected: string;
  rowSelected: string;


  ngOnInit() {
    this.columns = [
      {
        name: 'No',
        prop: 'number'
      },
      {
        name: 'Name',
        prop: 'name'
      },
      {
        name: 'Age',
        prop: 'age'
      },
    ];

    this.rows = [
      {
        name: 'Marta Mccoy',
        age: 31,
        auth: {
          canRead: true,
          canUpdate: true,
          canPrint: true,
        }
      },
      {
        name: 'Fanny Holman',
        age: 23,
        auth: {
          canDelete: true,
          canActivate: true,
        }
      },
      {
        name: 'Latonya Gibson',
        age: 22,
        auth: {
          canPublish: true,
          canValidate: true,
        }
      },
      {
        name: 'Ines Wiggins',
        age: 35,
