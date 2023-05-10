import React, { useRef, useEffect, useState } from "react";
import mapboxgl from "!mapbox-gl"; // eslint-disable-line import/no-webpack-loader-syntax
import "mapbox-gl/dist/mapbox-gl.css";

import { throttle } from "lodash";

import { geojson as flatgeobuf } from "flatgeobuf";

mapboxgl.accessToken =
  "pk.eyJ1IjoiYnJpYW5iYW5jcm9mdCIsImEiOiJsVGVnMXFzIn0.7ldhVh3Ppsgv4lCYs65UdA";

const file =
  "https://explorer-app-data.s3.us-west-1.amazonaws.com/res8/res8-usa-hexagons.fgb";

export default function App() {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [lng, setLng] = useState(-97.738);
  const [lat, setLat] = useState(40.261);
  const [zoom, setZoom] = useState(12.2);

  window.map = map;

  useEffect(() => {
    if (map.current) return; // initialize map only once
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [lng, lat],
      zoom: zoom,
    });

    // convert the rect into the format flatgeobuf expects
    function fgBoundingBox() {
      const { lng, lat } = map.current.getCenter();
      const { _sw, _ne } = map.current.getBounds();
      const size = Math.min(_ne.lng - lng, _ne.lat - lat) * 0.8;
      return {
        minX: lng - size,
        minY: lat - size,
        maxX: lng + size,
        maxY: lat + size,
      };
    }

    function getRect() {
      const bbox = fgBoundingBox();
      const coords = [
        [
          [bbox.minX, bbox.minY],
          [bbox.maxX, bbox.minY],
          [bbox.maxX, bbox.maxY],
          [bbox.minX, bbox.maxY],
          [bbox.minX, bbox.minY],
        ],
      ];
      return {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: { type: "Polygon", coordinates: coords },
          },
        ],
      };
    }

    async function updateResults() {
      let i = 0;
      const fc = { type: "FeatureCollection", features: [] };
      let iter = flatgeobuf.deserialize(file, fgBoundingBox());
      for await (let feature of iter) {
        fc.features.push({ ...feature, id: i });
        i += 1;
      }

      console.log("Fc ", fc);
      map.current.getSource("hex").setData(fc);
    }

    map.current.on("load", () => {
      map.current.addSource("hex", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.current.addLayer({
        id: "hex-fill",
        type: "fill",
        source: "hex",
        paint: {
          "fill-color": "rebeccapurple",
        },
      });
      map.current.addLayer({
        id: "hex-line",
        type: "line",
        source: "hex",
        paint: {
          "line-color": "purple",
          "line-opacity": 0.8,
          "line-width": 2,
        },
      });

      map.current.addSource("rectangle", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.current.addLayer({
        id: "rectangle",
        type: "line",
        source: "rectangle",
        paint: {
          "line-color": "#0000FF",
          "line-opacity": 0.9,
          "line-width": 3,
        },
      });

      // if the user is panning around alot, only update once per second max
      const updateResultsThrottled = throttle(updateResults, 1000);

      // show a rectangle corresponding to our bounding box
      map.current.getSource("rectangle").setData(getRect());

      // show results based on the initial map
      updateResultsThrottled();

      // ...and update the results whenever the map moves
      map.current.on("moveend", function (s) {
        map.current.getSource("rectangle").setData(getRect());
        updateResultsThrottled();
      });
    });
  });

  useEffect(() => {
    if (!map.current) return; // wait for map to initialize
    map.current.on("move", () => {
      setLng(map.current.getCenter().lng.toFixed(4));
      setLat(map.current.getCenter().lat.toFixed(4));
      setZoom(map.current.getZoom().toFixed(2));
    });
  });

  return (
    <div>
      <div className="sidebar">
        Longitude: {lng} | Latitude: {lat} | Zoom: {zoom}
      </div>
      <div ref={mapContainer} className="map-container" />
    </div>
  );
}
