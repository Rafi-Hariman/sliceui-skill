import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'ugw-table-with-checkbox',
  templateUrl: './table-with-checkbox.component.html',
  styleUrls: ['./table-with-checkbox.component.scss']
})
export class TableWithCheckboxComponent implements OnInit {

  rows: Array<any> = [];
  columns: Array<any> = [];
  rowSelected: Array<any> = [];


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
        has_checkbox: false
      },
      {
        name: 'Fanny Holman',
        age: 23
      },
      {
        name: 'Latonya Gibson',
        age: 22,
        has_checkbox: false
      },
      {
        name: 'Ines Wiggins',
        age: 35,
        has_checkbox_checked_default: true,
      },
      {
        name: 'Kathrine Irwin',
        age: 38
      },
      {
        name: 'Higgins Oneal',
        age: 35,
        has_checkbox_checked_default: true,
      },
      {
