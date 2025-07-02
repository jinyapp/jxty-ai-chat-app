// import React from 'react';
// import { Bubble } from '@ant-design/x';

// const AntDesignX = () => (
//   <div className="App">
//     <Bubble content="Hello world!" />
//   </div>
// );

// export default AntDesignX;



import { Welcome } from '@ant-design/x';
import { Card, ConfigProvider, Flex, theme } from 'antd';

const items: {
  algorithm: typeof theme.defaultAlgorithm;
  background: string;
}[] = [
  {
    algorithm: theme.defaultAlgorithm,
    background: 'linear-gradient(97deg, #f2f9fe 0%, #f7f3ff 100%)',
  },
//   {
//     algorithm: theme.darkAlgorithm,
//     background: 'linear-gradient(97deg, rgba(90,196,255,0.12) 0%, rgba(174,136,255,0.12) 100%)',
//   },
];

const AntDesignX = () => {
  return (
    <Flex vertical>
      {items.map(({ algorithm, background }, index) => (
        <ConfigProvider
          key={index}
          theme={{
            algorithm,
          }}
        >
          <Card style={{ borderRadius: 0 }}>
            <Welcome
              style={{
                backgroundImage: background,
                borderStartStartRadius: 4,
              }}
              icon="https://mdn.alipayobjects.com/huamei_iwk9zp/afts/img/A*s5sNRo5LjfQAAAAAAAAAAAAADgCCAQ/fmt.webp"
              title="Hello, I'm Ant Design X"
              description="Base on Ant Design, AGI product interface solution, create a better intelligent vision~"
            />
          </Card>
        </ConfigProvider>
      ))}
    </Flex>
  );
};

export default AntDesignX;