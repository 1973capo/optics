// 1. SVG 컨테이너 설정
const width = 960; // 시각화 너비
const height = 600; // 시각화 높이 (원하는 대로 조절 가능)

// SVG 요소 생성 (그래프가 그려질 도화지)
const svg = d3.select("#chart") // 'chart'라는 id를 가진 div 안에 SVG를 만듭니다.
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`) // 반응형 SVG를 위한 설정
    .style("width", "100%") // 부모 div에 맞게 너비 조절
    .style("max-width", `${width}px`) // SVG의 최대 너비
    .style("height", "auto") // 높이 자동 조절
    .style("display", "block") // 블록 요소로 표시
    .style("margin", "auto"); // 가운데 정렬

// 줌 및 팬 기능을 위한 그룹 (그래프의 모든 요소를 이 그룹 안에 넣습니다)
const g = svg.append("g");

// 2. 포스 시뮬레이션 생성
const simulation = d3.forceSimulation() // 물리 엔진 시뮬레이션 시작
    // 링크 힘: 연결된 노드들을 일정 거리에 두려고 합니다.
    .force("link", d3.forceLink().id(d => d.id).distance(100)) // id를 기준으로 노드를 찾고, 기본 거리 100
    // 전하 힘: 노드들이 서로 밀거나 당기게 합니다. (음수면 밀어냄)
    .force("charge", d3.forceManyBody().strength(-300)) // -300은 노드들을 강하게 밀어내 넓게 퍼지게 합니다.
    // 중앙 정렬 힘: 모든 노드를 SVG의 중앙으로 모으려고 합니다.
    .force("center", d3.forceCenter(width / 2, height / 2)) // SVG 중앙 좌표
    // 충돌 방지 힘: 노드들이 겹치지 않도록 합니다.
    .force("collision", d3.forceCollide().radius(d => d.r + 5)); // 각 노드 반지름 + 5픽셀 여유 공간

// 3. 데이터 로드 및 처리
// 'data.csv' 파일을 불러옵니다.
d3.csv("data.csv").then(linksData => {
    // 3.1. 노드 생성: CSV의 source와 target에서 모든 고유한 노드를 추출합니다.
    const nodesMap = new Map(); // 노드들을 저장할 Map (중복 방지)

    linksData.forEach(link => {
        // source 노드가 Map에 없으면 추가
        if (!nodesMap.has(link.source)) {
            nodesMap.set(link.source, { id: link.source, group: "" }); // id와 group 초기화
        }
        // target 노드가 Map에 없으면 추가
        if (!nodesMap.has(link.target)) {
            nodesMap.set(link.target, { id: link.target, group: "" }); // id와 group 초기화
        }

        // 노드 그룹 할당 (Company, Field, Role 구분)
        // 이 로직은 CSV의 link_type과 노드 ID를 기반으로 그룹을 추론합니다.
        // 더 정확한 방법은 별도의 노드 목록을 갖는 것이지만, 여기서는 이 방식을 사용합니다.
        if (link.link_type === "Company-Field") {
            nodesMap.get(link.source).group = "company";
            nodesMap.get(link.target).group = "field";
        } else if (link.link_type === "Field-Role") {
            nodesMap.get(link.source).group = "field";
            nodesMap.get(link.target).group = "role";
        } else if (link.link_type === "Role-Company") {
            nodesMap.get(link.source).group = "role"; // Role-Company의 source는 Role
            nodesMap.get(link.target).group = "company"; // Role-Company의 target은 Company
        }
    });

    const nodes = Array.from(nodesMap.values()); // Map의 값들을 배열로 변환하여 최종 노드 목록 생성

    // 각 노드에 반지름(r) 속성 추가 (그룹에 따라 다르게)
    nodes.forEach(node => {
        if (node.group === "company") node.r = 15; // 회사 노드는 크게
        else if (node.group === "field") node.r = 10; // 시장 노드는 중간
        else if (node.group === "role") node.r = 7; // 역할 노드는 작게
        else node.r = 5; // 기타 노드 (혹시 모를 경우)
    });

    const links = linksData; // CSV에서 불러온 링크 데이터 그대로 사용

    // 3.2. 포스 시뮬레이션에 노드와 링크 데이터 바인딩
    simulation
        .nodes(nodes) // 시뮬레이션에 노드 데이터 전달
        .on("tick", ticked); // 시뮬레이션이 한 단계 진행될 때마다 ticked 함수 호출

    simulation.force("link")
        .links(links) // 시뮬레이션에 링크 데이터 전달
        // 링크 거리 설정: value가 클수록(관계가 강할수록) 노드들을 더 가깝게 배치
        .distance(d => d.value ? Math.max(50, 200 - d.value / 10) : 100); // 50은 최소 거리, 200 - value/10으로 value가 커지면 거리가 줄어듦

    // 4. 링크 그리기: SVG 선 요소로 링크를 그립니다.
    const link = g.append("g")
        .attr("class", "links") // CSS 클래스 추가
        .selectAll("line") // 모든 line 요소를 선택 (아직 없음)
        .data(links) // 링크 데이터와 바인딩
        .enter().append("line") // 데이터 개수만큼 line 요소 추가
        .attr("class", "link") // CSS 클래스 추가
        .attr("stroke-width", d => Math.sqrt(d.value) / 5); // value가 클수록 선 두께를 두껍게

    // 5. 노드 그리기: SVG 원 요소로 노드를 그립니다.
    const node = g.append("g")
        .attr("class", "nodes") // CSS 클래스 추가
        .selectAll("circle") // 모든 circle 요소를 선택 (아직 없음)
        .data(nodes) // 노드 데이터와 바인딩
        .enter().append("circle") // 데이터 개수만큼 circle 요소 추가
        .attr("class", "node") // CSS 클래스 추가
        .attr("r", d => d.r) // 노드 반지름 설정
        .attr("fill", d => { // 노드 그룹에 따라 색상 설정
            if (d.group === "company") return "steelblue";
            else if (d.group === "field") return "lightcoral";
            else if (d.group === "role") return "mediumseagreen";
            return "gray"; // 기본 색상
        })
        .call(d3.drag() // 노드 드래그 기능 활성화
            .on("start", dragstarted) // 드래그 시작 시
            .on("drag", dragged)     // 드래그 중
            .on("end", dragended));   // 드래그 종료 시

    // 6. 노드 라벨 (텍스트) 그리기
    const labels = g.append("g")
        .attr("class", "labels") // CSS 클래스 추가
        .selectAll("text") // 모든 text 요소를 선택 (아직 없음)
        .data(nodes) // 노드 데이터와 바인딩
        .enter().append("text") // 데이터 개수만큼 text 요소 추가
        .attr("class", "node-label") // CSS 클래스 추가
        .text(d => d.id); // 노드 ID를 텍스트로 표시

    // 7. 시뮬레이션 틱 이벤트 핸들러
    // 시뮬레이션이 실행될 때마다 노드와 링크의 위치를 업데이트합니다.
    function ticked() {
        link
            .attr("x1", d => d.source.x) // 링크 시작 X 좌표
            .attr("y1", d => d.source.y) // 링크 시작 Y 좌표
            .attr("x2", d => d.target.x) // 링크 끝 X 좌표
            .attr("y2", d => d.target.y); // 링크 끝 Y 좌표

        node
            .attr("cx", d => d.x) // 노드 중심 X 좌표
            .attr("cy", d => d.y); // 노드 중심 Y 좌표

        labels
            .attr("x", d => d.x) // 라벨 X 좌표 (노드와 동일)
            .attr("y", d => d.y + d.r + 10); // 라벨 Y 좌표 (노드 아래에 배치)
    }

    // 8. 노드 드래그 핸들러 함수들
    function dragstarted(event, d) {
        if (!event.active) simulation.alphaTarget(0.3).restart(); // 시뮬레이션 활성화
        d.fx = d.x; // 드래그 시작 시 노드 위치 고정
        d.fy = d.y;
    }

    function dragged(event, d) {
        d.fx = event.x; // 드래그 중 노드 위치 업데이트
        d.fy = event.y;
    }

    function dragended(event, d) {
        if (!event.active) simulation.alphaTarget(0); // 드래그 종료 시 시뮬레이션 비활성화
        d.fx = null; // 노드 고정 해제 (물리 엔진이 다시 움직이게 함)
        d.fy = null;
    }

    // 9. 줌 기능 구현
    const zoomBehavior = d3.zoom()
        .scaleExtent([0.1, 8]) // 최소 줌 (0.1배)에서 최대 줌 (8배)까지
        .on("zoom", zoomed); // 줌 이벤트 발생 시 zoomed 함수 호출

    svg.call(zoomBehavior); // SVG 요소에 줌 행동을 적용

    function zoomed(event) {
        g.attr("transform", event.transform); // 줌 및 팬 변환을 'g' 그룹에 적용하여 전체 그래프를 이동/확대
    }

}).catch(error => {
    // CSV 파일을 로드하거나 처리하는 중 오류가 발생하면 콘솔에 메시지 출력
    console.error("CSV 데이터를 로드하거나 파싱하는 중 오류 발생:", error);
});