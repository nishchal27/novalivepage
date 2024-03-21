import React from "react";

const page = ({ params }: { params: { agencyId: string } }) => {
  console.log(params);
  return <div>{params?.agencyId}</div>
};

export default page;
