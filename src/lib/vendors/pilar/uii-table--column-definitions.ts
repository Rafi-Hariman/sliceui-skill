import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'ugw-table-with-checkbox',
  templateUrl: './column-definitions-table.component.html',
  styleUrls: ['./column-definitions-table.component.scss']
})
export class ColumnDefinitionsTableComponent implements OnInit {

  rows: Array<any> = [];
  columns: Array<any> = [];


  ngOnInit() {
    this.columns = [
      {
        name: 'No',
        prop: 'number'
      },
      {
        name: 'Name',
        prop: 'name',
      },
      {
        name: 'Age',
        prop: 'age'
      },
      {
        name: 'Marriage Status',
        prop: 'marriage_status',
        type: 'labelv2'
      },
      {
        name: 'Alive',
        prop: 'is_alive',
        type: 'html',
        orderable: false
      }
    ];

    this.rows = [
      {
        name: 'Marta Mccoy',
        age: 31,
        marriage_status: 1,
        is_alive: 1
      },
      {
        name: 'Fanny Holman',
        age: 23,
        marriage_status: 1,
        is_alive: 1
      },
      {
        name: 'Latonya Gibson',
        age: 22,
        marriage_status: 3,
        is_alive: 1
      },
      {
